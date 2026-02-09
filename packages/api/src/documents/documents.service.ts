import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TaxonomyService } from '../taxonomy/taxonomy.service'
import { SecurityLevelGuard } from '../auth/guards/security-level.guard'
import {
  LIFECYCLE_TRANSITIONS,
  FRESHNESS_THRESHOLDS,
  SECURITY_LEVEL_ORDER,
} from '@kms/shared'
import type {
  Lifecycle,
  SecurityLevel,
  UserRole,
  Freshness,
  DocumentListQuery,
} from '@kms/shared'

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  async create(
    data: {
      domain: string
      classifications: Record<string, string>
      securityLevel?: SecurityLevel
      lifecycle?: Lifecycle
    },
    file: Express.Multer.File,
    userId: string,
  ) {
    await this.taxonomy.validateDomain(data.domain)
    await this.taxonomy.validateClassifications(data.domain, data.classifications)

    const ext = file.originalname.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다')
    }

    const document = await this.prisma.document.create({
      data: {
        domain: data.domain,
        lifecycle: data.lifecycle ?? 'DRAFT',
        securityLevel: data.securityLevel ?? 'INTERNAL',
        filePath: file.path,
        fileName: file.originalname,
        fileType: ext,
        fileSize: file.size,
        createdById: userId,
        updatedById: userId,
        classifications: {
          create: Object.entries(data.classifications).map(([facetType, facetValue]) => ({
            facetType,
            facetValue,
          })),
        },
      },
      include: { classifications: true },
    })

    await this.prisma.documentHistory.create({
      data: {
        documentId: document.id,
        action: 'CREATE',
        changes: { classifications: data.classifications },
        userId,
      },
    })

    return this.formatDocument(document)
  }

  async findAll(query: DocumentListQuery, userRole: UserRole) {
    const { domain, lifecycle, securityLevel, carrier, product, docType, page = 1, size = 20, sort = 'createdAt', order = 'desc' } = query

    // 보안 등급 필터: 사용자 역할에 따라 접근 가능한 문서만
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    // securityLevel이 지정된 경우, 사용자 접근 가능 범위와 교차 검증
    const effectiveSecurityLevel = securityLevel && allowedLevels.includes(securityLevel)
      ? { equals: securityLevel }
      : { in: allowedLevels }

    const where = {
      isDeleted: false,
      ...(domain && { domain }),
      ...(lifecycle && { lifecycle }),
      securityLevel: effectiveSecurityLevel,
      ...(carrier && {
        classifications: {
          some: { facetType: 'carrier', facetValue: carrier },
        },
      }),
      ...(product && {
        classifications: {
          some: { facetType: 'product', facetValue: product },
        },
      }),
      ...(docType && {
        classifications: {
          some: { facetType: 'docType', facetValue: docType },
        },
      }),
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { classifications: true },
        orderBy: { [sort]: order },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.document.count({ where }),
    ])

    return {
      data: data.map((d) => this.formatDocument(d)),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  async findOne(id: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
      include: { classifications: true },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException(
        `이 문서는 ${doc.securityLevel} 등급입니다. 접근 권한이 없습니다.`,
      )
    }

    return this.formatDocument(doc)
  }

  /** 내부 전용 — filePath 포함하여 반환 (file download에서 사용) */
  async findOneInternal(id: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    return doc
  }

  async update(
    id: string,
    data: {
      classifications?: Record<string, string>
      securityLevel?: SecurityLevel
      rowVersion: number
    },
    userId: string,
    userRole: UserRole,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    if (doc.rowVersion !== data.rowVersion) {
      throw new ConflictException('다른 사용자가 수정했습니다. 새로고침 후 다시 시도하세요.')
    }

    if (data.securityLevel && data.securityLevel !== doc.securityLevel && userRole !== 'ADMIN') {
      throw new ForbiddenException('보안 등급 변경은 ADMIN만 가능합니다')
    }

    if (data.classifications) {
      await this.taxonomy.validateClassifications(doc.domain, data.classifications)
    }

    // 트랜잭션으로 분류 업데이트 + 문서 업데이트 원자적 실행
    const updated = await this.prisma.$transaction(async (tx) => {
      if (data.classifications) {
        await tx.classification.deleteMany({ where: { documentId: id } })
        await tx.classification.createMany({
          data: Object.entries(data.classifications).map(([facetType, facetValue]) => ({
            documentId: id,
            facetType,
            facetValue,
          })),
        })
      }

      return tx.document.update({
        where: { id },
        data: {
          updatedBy: { connect: { id: userId } },
          ...(data.securityLevel && { securityLevel: data.securityLevel }),
        },
        include: { classifications: true },
      })
    })

    await this.prisma.documentHistory.create({
      data: {
        documentId: id,
        action: 'UPDATE',
        changes: { classifications: data.classifications, securityLevel: data.securityLevel },
        userId,
      },
    })

    return this.formatDocument(updated)
  }

  async transitionLifecycle(id: string, lifecycle: Lifecycle, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const allowed = LIFECYCLE_TRANSITIONS[doc.lifecycle as Lifecycle]
    if (!allowed || !allowed.includes(lifecycle)) {
      throw new BadRequestException(
        `${doc.lifecycle} → ${lifecycle} 전환은 허용되지 않습니다`,
      )
    }

    // ACTIVE 전환 시 SSOT 사전 검증 (사용자 친화적 메시지)
    if (lifecycle === 'ACTIVE' && doc.classificationHash) {
      const existing = await this.prisma.document.findFirst({
        where: {
          classificationHash: doc.classificationHash,
          lifecycle: 'ACTIVE',
          isDeleted: false,
          id: { not: id },
        },
      })
      if (existing) {
        throw new ConflictException(
          `동일 분류 경로에 이미 ACTIVE 문서가 존재합니다 (${existing.fileName}). SSOT 위반입니다.`,
        )
      }
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        lifecycle,
        updatedBy: { connect: { id: userId } },
      },
      include: { classifications: true },
    })

    await this.prisma.documentHistory.create({
      data: {
        documentId: id,
        action: 'LIFECYCLE_CHANGE',
        changes: { from: doc.lifecycle, to: lifecycle },
        userId,
      },
    })

    return this.formatDocument(updated)
  }

  async softDelete(id: string, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    await this.prisma.document.update({
      where: { id },
      data: { isDeleted: true, updatedBy: { connect: { id: userId } } },
    })

    await this.prisma.documentHistory.create({
      data: { documentId: id, action: 'DELETE', userId },
    })
  }

  /** API 응답 포맷 (filePath 미노출, downloadUrl 제공) */
  private formatDocument(
    doc: {
      id: string
      domain: string
      lifecycle: string
      securityLevel: string
      fileName: string
      fileType: string
      fileSize: bigint | null
      versionMajor: number
      versionMinor: number
      classificationHash: string | null
      reviewedAt: Date | null
      rowVersion: number
      createdById: string | null
      createdAt: Date
      updatedAt: Date
      classifications: Array<{ facetType: string; facetValue: string }>
    },
  ) {
    const classifications: Record<string, string> = {}
    for (const c of doc.classifications) {
      classifications[c.facetType] = c.facetValue
    }

    return {
      id: doc.id,
      domain: doc.domain,
      lifecycle: doc.lifecycle,
      securityLevel: doc.securityLevel,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: Number(doc.fileSize ?? 0),
      downloadUrl: `/api/documents/${doc.id}/file`,
      versionMajor: doc.versionMajor,
      versionMinor: doc.versionMinor,
      classificationHash: doc.classificationHash,
      reviewedAt: doc.reviewedAt?.toISOString() ?? null,
      rowVersion: doc.rowVersion,
      createdBy: doc.createdById,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      classifications,
      freshness: this.calcFreshness(doc),
    }
  }

  private calcFreshness(doc: {
    lifecycle: string
    reviewedAt: Date | null
    updatedAt: Date
  }): Freshness | null {
    if (doc.lifecycle !== 'ACTIVE') return null

    const baseDate = doc.reviewedAt ?? doc.updatedAt
    const daysSince = Math.floor(
      (Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysSince < FRESHNESS_THRESHOLDS.HOT) return 'FRESH'
    if (daysSince < FRESHNESS_THRESHOLDS.WARM) return 'WARNING'
    return 'EXPIRED'
  }
}
