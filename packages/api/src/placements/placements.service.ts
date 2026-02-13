import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SecurityLevelGuard } from '../auth/guards/security-level.guard'
import { SECURITY_LEVEL_ORDER } from '@kms/shared'
import type { SecurityLevel, UserRole, DocumentPlacementEntity, BulkPlacementResult } from '@kms/shared'

@Injectable()
export class PlacementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDocument(documentId: string, userRole: UserRole): Promise<DocumentPlacementEntity[]> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, isDeleted: false },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const placements = await this.prisma.documentPlacement.findMany({
      where: { documentId },
      include: {
        domain: { select: { displayName: true } },
        category: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { placedAt: 'desc' },
    })

    return placements.map((p) => this.formatPlacement(p))
  }

  async findByDomain(
    domainCode: string,
    options: {
      categoryId?: number | null
      lifecycle?: string
      sort?: string
      order?: 'asc' | 'desc'
      page?: number
      size?: number
    },
    userRole: UserRole,
  ) {
    const { categoryId, lifecycle, sort = 'createdAt', order = 'desc', page = 1, size = 20 } = options
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    const where = {
      domainCode,
      ...(categoryId !== undefined && categoryId !== null && { categoryId }),
      document: {
        isDeleted: false,
        securityLevel: { in: allowedLevels },
        ...(lifecycle && { lifecycle }),
      },
    }

    // 정렬: document 필드 기반
    const documentSortFields = ['fileName', 'createdAt', 'updatedAt', 'lifecycle', 'docCode']
    const orderBy = documentSortFields.includes(sort)
      ? { document: { [sort]: order } }
      : { placedAt: order as 'asc' | 'desc' }

    const [data, total] = await Promise.all([
      this.prisma.documentPlacement.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              docCode: true,
              fileName: true,
              fileType: true,
              fileSize: true,
              filePath: true,
              fileHash: true,
              lifecycle: true,
              securityLevel: true,
              versionMajor: true,
              versionMinor: true,
              reviewedAt: true,
              validUntil: true,
              rowVersion: true,
              createdById: true,
              createdAt: true,
              updatedAt: true,
              _count: { select: { sourceRelations: true, targetRelations: true, placements: true } },
            },
          },
          category: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy,
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.documentPlacement.count({ where }),
    ])

    return {
      data: data.map((p) => ({
        id: p.document.id,
        docCode: p.document.docCode,
        fileName: p.document.fileName,
        fileType: p.document.fileType,
        fileSize: Number(p.document.fileSize ?? 0),
        fileHash: p.document.fileHash,
        downloadUrl: p.document.filePath ? `/api/documents/${p.document.id}/file` : null,
        lifecycle: p.document.lifecycle,
        securityLevel: p.document.securityLevel,
        versionMajor: p.document.versionMajor,
        versionMinor: p.document.versionMinor,
        reviewedAt: p.document.reviewedAt?.toISOString() ?? null,
        validUntil: p.document.validUntil?.toISOString() ?? null,
        rowVersion: p.document.rowVersion,
        createdBy: p.document.createdById,
        createdAt: p.document.createdAt.toISOString(),
        updatedAt: p.document.updatedAt.toISOString(),
        freshness: null,
        placementCount: p.document._count.placements,
        relationCount: p.document._count.sourceRelations + p.document._count.targetRelations,
      })),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  async create(
    data: { documentId: string; domainCode: string; categoryId?: number; alias?: string; note?: string },
    userId: string,
    userRole: UserRole,
  ) {
    // 문서 존재 확인
    const doc = await this.prisma.document.findFirst({
      where: { id: data.documentId, isDeleted: false },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    // 도메인 존재 확인
    const domain = await this.prisma.domainMaster.findUnique({
      where: { code: data.domainCode },
    })
    if (!domain || !domain.isActive) {
      throw new BadRequestException(`유효하지 않은 도메인입니다: ${data.domainCode}`)
    }

    // 카테고리 확인
    if (data.categoryId) {
      const category = await this.prisma.domainCategory.findUnique({
        where: { id: data.categoryId },
      })
      if (!category || category.domainCode !== data.domainCode) {
        throw new BadRequestException('카테고리가 해당 도메인에 존재하지 않습니다')
      }
    }

    try {
      const placement = await this.prisma.documentPlacement.create({
        data: {
          documentId: data.documentId,
          domainCode: data.domainCode,
          categoryId: data.categoryId ?? null,
          placedBy: userId,
          alias: data.alias ?? null,
          note: data.note ?? null,
        },
        include: {
          domain: { select: { displayName: true } },
          category: { select: { name: true } },
          user: { select: { name: true } },
        },
      })

      // 이력 기록
      await this.prisma.documentHistory.create({
        data: {
          documentId: data.documentId,
          action: 'PLACEMENT_ADD',
          changes: { domainCode: data.domainCode, domainName: domain.displayName },
          userId,
        },
      })

      return this.formatPlacement(placement)
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('이 문서는 이미 해당 도메인에 배치되어 있습니다')
      }
      throw error
    }
  }

  async update(id: string, data: { categoryId?: number | null; alias?: string | null; note?: string }) {
    const placement = await this.prisma.documentPlacement.findUnique({
      where: { id },
    })
    if (!placement) throw new NotFoundException('배치를 찾을 수 없습니다')

    if (data.categoryId !== undefined && data.categoryId !== null) {
      const category = await this.prisma.domainCategory.findUnique({
        where: { id: data.categoryId },
      })
      if (!category || category.domainCode !== placement.domainCode) {
        throw new BadRequestException('카테고리가 해당 도메인에 존재하지 않습니다')
      }
    }

    const updated = await this.prisma.documentPlacement.update({
      where: { id },
      data: {
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.alias !== undefined && { alias: data.alias }),
        ...(data.note !== undefined && { note: data.note }),
      },
      include: {
        domain: { select: { displayName: true } },
        category: { select: { name: true } },
        user: { select: { name: true } },
      },
    })

    return this.formatPlacement(updated)
  }

  async remove(id: string, userId: string) {
    const placement = await this.prisma.documentPlacement.findUnique({
      where: { id },
      include: { domain: { select: { displayName: true } } },
    })
    if (!placement) throw new NotFoundException('배치를 찾을 수 없습니다')

    await this.prisma.$transaction(async (tx) => {
      // 해당 도메인의 domain-scoped 관계도 함께 삭제
      // OR 조건으로 source/target 양쪽 모두 커버 → 양방향 관계(PARENT_OF↔CHILD_OF)도 삭제됨
      await tx.relation.deleteMany({
        where: {
          domainCode: placement.domainCode,
          OR: [
            { sourceId: placement.documentId },
            { targetId: placement.documentId },
          ],
        },
      })

      await tx.documentPlacement.delete({ where: { id } })

      // 이력 기록
      await tx.documentHistory.create({
        data: {
          documentId: placement.documentId,
          action: 'PLACEMENT_REMOVE',
          changes: { domainCode: placement.domainCode, domainName: placement.domain.displayName },
          userId,
        },
      })
    })

    return { message: '배치가 해제되었습니다' }
  }

  private formatPlacement(p: {
    id: string
    documentId: string
    domainCode: string
    categoryId: number | null
    placedBy: string | null
    placedAt: Date
    alias: string | null
    note: string | null
    domain: { displayName: string }
    category: { name: string } | null
    user: { name: string } | null
  }): DocumentPlacementEntity {
    return {
      id: p.id,
      documentId: p.documentId,
      domainCode: p.domainCode,
      domainName: p.domain.displayName,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      placedBy: p.placedBy,
      placedByName: p.user?.name ?? null,
      placedAt: p.placedAt.toISOString(),
      alias: p.alias,
      note: p.note,
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    )
  }

  /**
   * 일괄 배치: 여러 문서를 한 도메인에 배치
   * 대용량 처리를 위해 배치 단위 + 트랜잭션 사용
   */
  async bulkCreate(
    data: { documentIds: string[]; domainCode: string; categoryId?: number },
    userId: string,
    userRole: UserRole,
  ): Promise<BulkPlacementResult> {
    const { documentIds, domainCode, categoryId } = data
    const result: BulkPlacementResult = { success: 0, failed: 0, errors: [] }

    // 도메인 존재 확인
    const domain = await this.prisma.domainMaster.findUnique({
      where: { code: domainCode },
    })
    if (!domain || !domain.isActive) {
      throw new BadRequestException(`유효하지 않은 도메인입니다: ${domainCode}`)
    }

    // 카테고리 확인
    if (categoryId) {
      const category = await this.prisma.domainCategory.findUnique({
        where: { id: categoryId },
      })
      if (!category || category.domainCode !== domainCode) {
        throw new BadRequestException('카테고리가 해당 도메인에 존재하지 않습니다')
      }
    }

    // 1. 문서 일괄 조회
    const docs = await this.prisma.document.findMany({
      where: { id: { in: documentIds }, isDeleted: false },
    })
    const docMap = new Map(docs.map((d) => [d.id, d]))

    // 2. 이미 배치된 문서 조회 (중복 체크용)
    const existingPlacements = await this.prisma.documentPlacement.findMany({
      where: {
        documentId: { in: documentIds },
        domainCode,
      },
      select: { documentId: true },
    })
    const alreadyPlacedIds = new Set(existingPlacements.map((p) => p.documentId))

    // 3. 유효한 문서 필터링
    const validDocs: string[] = []
    for (const docId of documentIds) {
      const doc = docMap.get(docId)

      if (!doc) {
        result.failed++
        result.errors.push({ documentId: docId, reason: '문서를 찾을 수 없습니다' })
        continue
      }

      if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
        result.failed++
        result.errors.push({ documentId: docId, reason: '접근 권한이 없습니다' })
        continue
      }

      if (alreadyPlacedIds.has(docId)) {
        result.failed++
        result.errors.push({ documentId: docId, reason: '이미 해당 도메인에 배치됨' })
        continue
      }

      validDocs.push(docId)
    }

    // 4. 배치 단위로 트랜잭션 처리 (500개씩)
    const BATCH_SIZE = 500
    for (let i = 0; i < validDocs.length; i += BATCH_SIZE) {
      const batch = validDocs.slice(i, i + BATCH_SIZE)

      try {
        await this.prisma.$transaction(async (tx) => {
          // 배치 생성
          await tx.documentPlacement.createMany({
            data: batch.map((docId) => ({
              documentId: docId,
              domainCode,
              categoryId: categoryId ?? null,
              placedBy: userId,
              alias: null,
              note: null,
            })),
            skipDuplicates: true,
          })

          // 이력 일괄 생성
          await tx.documentHistory.createMany({
            data: batch.map((docId) => ({
              documentId: docId,
              action: 'PLACEMENT_ADD',
              changes: { domainCode, domainName: domain.displayName },
              userId,
            })),
          })
        })

        result.success += batch.length
      } catch {
        // 배치 전체 실패 시 개별 처리로 폴백
        for (const docId of batch) {
          try {
            await this.prisma.documentPlacement.create({
              data: {
                documentId: docId,
                domainCode,
                categoryId: categoryId ?? null,
                placedBy: userId,
                alias: null,
                note: null,
              },
            })
            await this.prisma.documentHistory.create({
              data: {
                documentId: docId,
                action: 'PLACEMENT_ADD',
                changes: { domainCode, domainName: domain.displayName },
                userId,
              },
            })
            result.success++
          } catch (error: unknown) {
            result.failed++
            if (this.isUniqueViolation(error)) {
              result.errors.push({ documentId: docId, reason: '이미 해당 도메인에 배치됨' })
            } else {
              result.errors.push({ documentId: docId, reason: '배치 실패' })
            }
          }
        }
      }
    }

    return result
  }
}
