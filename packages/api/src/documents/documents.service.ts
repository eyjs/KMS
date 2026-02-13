import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
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
import * as crypto from 'crypto'
import * as fs from 'fs'

type IssueType = 'warning' | 'expired' | 'no_file' | 'stale_draft' | 'long_orphan' | 'duplicate_name'

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /** 역할별 접근 가능 보안등급 목록 */
  private getAllowedLevels(userRole: UserRole): string[] {
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    return Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)
  }

  /** 이슈 유형별 Prisma where 조건 빌더 */
  private buildIssueWhere(type: IssueType, allowedLevels: string[]) {
    const baseWhere = {
      isDeleted: false,
      securityLevel: { in: allowedLevels },
    }

    const now = new Date()
    const hotDate = new Date(Date.now() - FRESHNESS_THRESHOLDS.HOT * 86400000)
    const warmDate = new Date(Date.now() - FRESHNESS_THRESHOLDS.WARM * 86400000)
    const hotFromNow = new Date(Date.now() + FRESHNESS_THRESHOLDS.HOT * 86400000)

    switch (type) {
      case 'warning':
        return {
          ...baseWhere,
          lifecycle: 'ACTIVE',
          OR: [
            { validUntil: { gte: now, lt: hotFromNow } },
            { validUntil: null, reviewedAt: { lt: hotDate, gte: warmDate } },
            { validUntil: null, reviewedAt: null, updatedAt: { lt: hotDate, gte: warmDate } },
          ],
        }
      case 'expired':
        return {
          ...baseWhere,
          lifecycle: 'ACTIVE',
          OR: [
            { validUntil: { lt: now } },
            { validUntil: null, reviewedAt: { lt: warmDate } },
            { validUntil: null, reviewedAt: null, updatedAt: { lt: warmDate } },
          ],
        }
      case 'no_file':
        return {
          ...baseWhere,
          filePath: null,
          lifecycle: { not: 'DEPRECATED' },
        }
      case 'stale_draft':
        return {
          ...baseWhere,
          lifecycle: 'DRAFT',
          updatedAt: { lt: new Date(Date.now() - 30 * 86400000) },
        }
      case 'long_orphan':
        return {
          ...baseWhere,
          placements: { none: {} },
          lifecycle: { not: 'DEPRECATED' },
          createdAt: { lt: new Date(Date.now() - 30 * 86400000) },
        }
      case 'duplicate_name':
        // duplicate_name은 별도 쿼리로 처리 — 여기서는 baseWhere만 반환
        return baseWhere
    }
  }

  /** SHA-256 해시 계산 */
  private calculateFileHash(filePath: string): string {
    const buffer = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  /** 파일명 디코딩: latin1 → UTF-8, URL-encoded → UTF-8 */
  private decodeFileName(originalname: string): string {
    let name = Buffer.from(originalname, 'latin1').toString('utf8')
    // URL 인코딩된 경우 추가 디코딩 (%XX 패턴)
    if (/%[0-9A-Fa-f]{2}/.test(name)) {
      try {
        name = decodeURIComponent(name)
      } catch {
        // 디코딩 실패 시 원본 유지
      }
    }
    return name
  }

  async create(
    data: {
      securityLevel?: SecurityLevel
      validUntil?: string
    },
    file: Express.Multer.File | null,
    userId: string,
    userRole: UserRole,
  ) {
    if (!file) {
      throw new BadRequestException('파일이 필요합니다')
    }

    const originalName = this.decodeFileName(file.originalname)
    const ext = originalName.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다')
    }

    // SHA-256 해시 계산 + 중복 체크 (documents + document_versions 모두)
    const fileHash = this.calculateFileHash(file.path)
    const existing = await this.checkFileHashDuplicate(fileHash)
    if (existing) {
      try { fs.unlinkSync(file.path) } catch { /* 임시 파일 삭제 실패 무시 */ }
      const canSee = SecurityLevelGuard.canAccess(userRole, existing.securityLevel as SecurityLevel)
      throw new ConflictException({
        message: '동일한 파일이 이미 존재합니다',
        ...(canSee && {
          existingDocumentId: existing.id,
          existingDocCode: existing.docCode,
          existingFileName: existing.fileName,
        }),
      })
    }

    // 문서 코드 생성: DOC-{YYMM}-{NNN}
    const createDocument = async (docCode: string) =>
      this.prisma.document.create({
        data: {
          docCode,
          lifecycle: 'DRAFT',
          securityLevel: data.securityLevel ?? 'INTERNAL',
          filePath: file.path,
          fileName: originalName,
          fileType: ext,
          fileSize: file.size,
          fileHash,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          createdById: userId,
          updatedById: userId,
        },
      })

    let document: Awaited<ReturnType<typeof createDocument>> | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        document = await createDocument(await this.generateDocCode())
        break
      } catch (error: unknown) {
        const isUniqueViolation = typeof error === 'object' && error !== null
          && 'code' in error && (error as { code: string }).code === 'P2002'
        if (!isUniqueViolation || attempt === 2) throw error
      }
    }
    if (!document) throw new BadRequestException('문서 코드 생성에 실패했습니다')

    await this.prisma.documentHistory.create({
      data: {
        documentId: document.id,
        action: 'CREATE',
        changes: { fileName: originalName },
        userId,
      },
    })

    return this.formatDocument(document)
  }

  /** 대량 업로드 */
  async bulkCreate(
    files: Express.Multer.File[],
    securityLevel: SecurityLevel | undefined,
    userId: string,
    userRole: UserRole,
  ) {
    const results: Array<{
      fileName: string
      success: boolean
      documentId?: string
      docCode?: string | null
      error?: string
      existingDocumentId?: string
    }> = []

    for (const file of files) {
      try {
        const doc = await this.create({ securityLevel }, file, userId, userRole)
        results.push({
          fileName: file.originalname,
          success: true,
          documentId: doc.id,
          docCode: doc.docCode,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류'
        const conflictData = err instanceof ConflictException
          ? (err.getResponse() as Record<string, unknown>)
          : undefined
        results.push({
          fileName: file.originalname,
          success: false,
          error: message,
          existingDocumentId: conflictData?.existingDocumentId as string | undefined,
        })
      }
    }

    return {
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    }
  }

  async findAll(query: DocumentListQuery, userRole: UserRole) {
    const { domain, lifecycle, securityLevel, orphan, page = 1, size = 20, sort = 'createdAt', order = 'desc' } = query

    const allowedLevels = this.getAllowedLevels(userRole)
    const effectiveSecurityLevel = securityLevel && allowedLevels.includes(securityLevel)
      ? { equals: securityLevel }
      : { in: allowedLevels }

    // 도메인 필터: placement 기반
    let domainFilter = {}
    if (domain) {
      domainFilter = {
        placements: { some: { domainCode: domain } },
      }
    }

    // 고아 필터
    let orphanFilter = {}
    if (orphan) {
      orphanFilter = {
        placements: { none: {} },
      }
    }

    const where = {
      isDeleted: false,
      ...domainFilter,
      ...orphanFilter,
      ...(lifecycle && { lifecycle }),
      securityLevel: effectiveSecurityLevel,
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          _count: { select: { sourceRelations: true, targetRelations: true, placements: true } },
          placements: {
            select: { domainCode: true, domain: { select: { displayName: true } } },
          },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.document.count({ where }),
    ])

    return {
      data: data.map((d) => ({
        ...this.formatDocument(d),
        placements: d.placements.map((p) => ({
          domainCode: p.domainCode,
          domainName: p.domain.displayName,
        })),
      })),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  /** 내가 올린 문서 목록 */
  async findMyDocuments(userId: string, userRole: UserRole, page: number = 1, size: number = 20, orphan?: boolean | null) {
    const where: Record<string, unknown> = {
      createdById: userId,
      isDeleted: false,
    }

    // 서버 사이드 배치 필터
    if (orphan === true) {
      where.placements = { none: {} }
    } else if (orphan === false) {
      where.placements = { some: {} }
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          _count: { select: { sourceRelations: true, targetRelations: true, placements: true } },
          placements: {
            include: {
              domain: { select: { displayName: true } },
              category: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.document.count({ where }),
    ])

    return {
      data: data.map((d) => ({
        ...this.formatDocument(d),
        placements: d.placements.map((p) => ({
          domainCode: p.domainCode,
          domainName: p.domain.displayName,
          categoryName: p.category?.name ?? null,
        })),
      })),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  /** 고아 문서 목록 */
  async findOrphans(userRole: UserRole, page: number = 1, size: number = 20) {
    const allowedLevels = this.getAllowedLevels(userRole)

    const where = {
      isDeleted: false,
      securityLevel: { in: allowedLevels },
      placements: { none: {} },
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          _count: { select: { sourceRelations: true, targetRelations: true, placements: true } },
        },
        orderBy: { createdAt: 'desc' },
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
      include: {
        _count: { select: { placements: true } },
        placements: {
          include: {
            domain: { select: { displayName: true } },
            category: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
      },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException(
        `이 문서는 ${doc.securityLevel} 등급입니다. 접근 권한이 없습니다.`,
      )
    }

    return {
      ...this.formatDocument(doc),
      placements: doc.placements.map((p) => ({
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
      })),
    }
  }

  /** 내부 전용 — filePath 포함하여 반환 */
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

  async attachFile(id: string, file: Express.Multer.File, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const originalName = this.decodeFileName(file.originalname)
    const ext = originalName.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다')
    }

    const fileHash = this.calculateFileHash(file.path)
    const isReplace = !!doc.filePath
    const newMinor = isReplace ? doc.versionMinor + 1 : doc.versionMinor

    // 아카이빙 + 업데이트 + 이력을 트랜잭션으로 묶어 데이터 정합성 보장
    const updated = await this.prisma.$transaction(async (tx) => {
      // 기존 파일이 있으면 → document_versions에 아카이빙
      if (isReplace && doc.filePath && doc.fileName && doc.fileType && doc.fileSize) {
        await tx.documentVersion.create({
          data: {
            documentId: id,
            versionMajor: doc.versionMajor,
            versionMinor: doc.versionMinor,
            filePath: doc.filePath,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            fileHash: doc.fileHash ?? '',
            uploadedById: doc.updatedById ?? doc.createdById,
          },
        })
      }

      const result = await tx.document.update({
        where: { id },
        data: {
          filePath: file.path,
          fileName: originalName,
          fileType: ext,
          fileSize: file.size,
          fileHash,
          versionMinor: newMinor,
          updatedBy: { connect: { id: userId } },
        },
      })

      await tx.documentHistory.create({
        data: {
          documentId: id,
          action: isReplace ? 'FILE_REPLACE' : 'FILE_ATTACH',
          changes: {
            fileName: originalName,
            fileType: ext,
            ...(isReplace && {
              previousVersion: `v${doc.versionMajor}.${doc.versionMinor}`,
              newVersion: `v${doc.versionMajor}.${newMinor}`,
              previousFileName: doc.fileName,
            }),
          },
          userId,
        },
      })

      return result
    })

    return this.formatDocument(updated)
  }

  async update(
    id: string,
    data: {
      securityLevel?: SecurityLevel
      validUntil?: string | null
      fileName?: string
      rowVersion: number
    },
    userId: string,
    userRole: UserRole,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
      include: { _count: { select: { placements: true } } },
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

    // 파일명 변경: 업로더 또는 ADMIN만 가능
    if (data.fileName && data.fileName !== doc.fileName) {
      if (doc.createdById !== userId && userRole !== 'ADMIN') {
        throw new ForbiddenException('원본 파일명은 업로더 또는 관리자만 변경할 수 있습니다')
      }
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        updatedBy: { connect: { id: userId } },
        ...(data.securityLevel && { securityLevel: data.securityLevel }),
        ...(data.fileName && { fileName: data.fileName }),
        ...(data.validUntil !== undefined && {
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
        }),
      },
      include: { _count: { select: { placements: true } } },
    })

    await this.prisma.documentHistory.create({
      data: {
        documentId: id,
        action: 'UPDATE',
        changes: { securityLevel: data.securityLevel, fileName: data.fileName },
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

    // DRAFT → ACTIVE: major 버전 증가
    const versionBump = doc.lifecycle === 'DRAFT' && lifecycle === 'ACTIVE'
      ? { versionMajor: doc.versionMajor + 1, versionMinor: 0 }
      : {}

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        lifecycle,
        ...versionBump,
        updatedBy: { connect: { id: userId } },
      },
    })

    await this.prisma.documentHistory.create({
      data: {
        documentId: id,
        action: 'LIFECYCLE_CHANGE',
        changes: {
          from: doc.lifecycle,
          to: lifecycle,
          ...(versionBump.versionMajor !== undefined && {
            newVersion: `v${versionBump.versionMajor}.0`,
          }),
        },
        userId,
      },
    })

    return this.formatDocument(updated)
  }

  async bulkTransitionLifecycle(ids: string[], lifecycle: Lifecycle, userId: string, userRole: UserRole) {
    const results: Array<{ id: string; success: boolean; error?: string }> = []

    for (const id of ids) {
      try {
        await this.transitionLifecycle(id, lifecycle, userId, userRole)
        results.push({ id, success: true })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류'
        results.push({ id, success: false, error: message })
      }
    }

    const succeeded = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    return { succeeded, failed, results }
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

  async getStats(userRole: UserRole) {
    const allowedLevels = this.getAllowedLevels(userRole)
    const where = { isDeleted: false, securityLevel: { in: allowedLevels } }

    const [total, active, draft, deprecated, orphan] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.count({ where: { ...where, lifecycle: 'ACTIVE' } }),
      this.prisma.document.count({ where: { ...where, lifecycle: 'DRAFT' } }),
      this.prisma.document.count({ where: { ...where, lifecycle: 'DEPRECATED' } }),
      this.prisma.document.count({ where: { ...where, placements: { none: {} } } }),
    ])

    // 도메인별 통계: placement 기반
    const domains = await this.prisma.domainMaster.findMany({ where: { isActive: true } })
    const byDomain = await Promise.all(
      domains.map(async (d: { code: string; displayName: string }) => {
        const dWhere = {
          ...where,
          placements: { some: { domainCode: d.code } },
        }
        const dTotal = await this.prisma.document.count({ where: dWhere })
        return {
          domain: d.code,
          displayName: d.displayName,
          total: dTotal,
        }
      }),
    )

    return {
      total,
      active,
      draft,
      deprecated,
      orphan,
      byDomain,
    }
  }

  async getRecent(limit: number, userRole: UserRole) {
    const allowedLevels = this.getAllowedLevels(userRole)

    const histories = await this.prisma.documentHistory.findMany({
      take: Math.min(limit, 50),
      orderBy: { createdAt: 'desc' },
      include: {
        document: { select: { fileName: true, securityLevel: true, isDeleted: true } },
        user: { select: { name: true } },
      },
    })

    return histories
      .filter((h: { document: { isDeleted: boolean; securityLevel: string } }) =>
        !h.document.isDeleted && allowedLevels.includes(h.document.securityLevel),
      )
      .map((h: {
        id: string; documentId: string; action: string; changes: unknown;
        createdAt: Date; document: { fileName: string | null };
        user: { name: string } | null;
      }) => ({
        id: h.id,
        documentId: h.documentId,
        fileName: h.document.fileName,
        action: h.action,
        changes: h.changes as Record<string, unknown> | null,
        userName: h.user?.name ?? null,
        createdAt: h.createdAt.toISOString(),
      }))
  }

  async search(
    params: { q?: string; domain?: string; lifecycle?: string; orphan?: boolean; page: number; size: number },
    userRole: UserRole,
  ) {
    const allowedLevels = this.getAllowedLevels(userRole)
    const { q, domain, lifecycle, orphan, page = 1, size = 20 } = params

    // 도메인 필터: placement 기반
    let domainFilter = {}
    if (domain) {
      domainFilter = {
        placements: { some: { domainCode: domain } },
      }
    }

    // 고아 필터
    let orphanFilter = {}
    if (orphan) {
      orphanFilter = {
        placements: { none: {} },
      }
    }

    // 키워드: 파일명 또는 문서코드에서 검색
    const keywordFilter = q ? {
      OR: [
        { fileName: { contains: q, mode: 'insensitive' as const } },
        { docCode: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {}

    const where = {
      isDeleted: false,
      securityLevel: { in: allowedLevels },
      ...keywordFilter,
      ...domainFilter,
      ...orphanFilter,
      ...(lifecycle && { lifecycle }),
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          _count: { select: { sourceRelations: true, targetRelations: true, placements: true } },
          placements: {
            select: { domainCode: true, domain: { select: { displayName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.document.count({ where }),
    ])

    return {
      data: data.map((d) => ({
        ...this.formatDocument(d),
        placements: d.placements.map((p) => ({
          domainCode: p.domainCode,
          domainName: p.domain.displayName,
        })),
      })),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  async getHistory(id: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const history = await this.prisma.documentHistory.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    })

    // 관계 이력의 targetId를 문서명/코드로 해석
    const relationEntries = history.filter((h: { action: string; changes: unknown }) => {
      const changes = h.changes as Record<string, unknown> | null
      return (h.action === 'RELATION_ADD' || h.action === 'RELATION_REMOVE') && changes?.targetId
    })

    const targetIds = [...new Set(
      relationEntries
        .map((h: { changes: unknown }) => (h.changes as Record<string, unknown>)?.targetId as string)
        .filter(Boolean),
    )]

    const targetDocMap = new Map<string, { fileName: string | null; docCode: string | null }>()
    if (targetIds.length > 0) {
      const targetDocs = await this.prisma.document.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, fileName: true, docCode: true },
      })
      for (const td of targetDocs) {
        targetDocMap.set(td.id, { fileName: td.fileName, docCode: td.docCode })
      }
    }

    return history.map((h: { id: string; action: string; changes: unknown; createdAt: Date; user: { name: string } | null }) => {
      const changes = h.changes as Record<string, unknown> | null
      let enrichedChanges = changes

      if ((h.action === 'RELATION_ADD' || h.action === 'RELATION_REMOVE') && changes?.targetId) {
        const target = targetDocMap.get(changes.targetId as string)
        enrichedChanges = {
          ...changes,
          targetFileName: target?.fileName ?? null,
          targetDocCode: target?.docCode ?? null,
        }
      }

      return {
        id: h.id,
        action: h.action,
        changes: enrichedChanges,
        userName: h.user?.name ?? null,
        createdAt: h.createdAt.toISOString(),
      }
    })
  }

  async getIssueDocuments(type: IssueType, page: number, size: number, userRole: UserRole) {
    // duplicate_name은 별도 쿼리
    if (type === 'duplicate_name') {
      return this.getDuplicateNameDocuments(page, size, userRole)
    }

    const where = this.buildIssueWhere(type, this.getAllowedLevels(userRole))

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { _count: { select: { placements: true } } },
        orderBy: { updatedAt: 'asc' },
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

  async getIssueCounts(userRole: UserRole) {
    const allowedLevels = this.getAllowedLevels(userRole)
    const issueTypes: IssueType[] = ['warning', 'expired', 'no_file', 'stale_draft', 'long_orphan']

    const counts = await Promise.all(
      issueTypes.map((t) => this.prisma.document.count({ where: this.buildIssueWhere(t, allowedLevels) })),
    )

    // duplicate_name: raw query
    const dupResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM (
        SELECT file_name FROM documents
        WHERE is_deleted = false AND file_name IS NOT NULL
          AND security_level IN (${Prisma.join(allowedLevels)})
        GROUP BY file_name HAVING COUNT(*) > 1
      ) sub
    `
    const duplicateName = Number(dupResult[0]?.count ?? 0)

    return {
      warning: counts[0],
      expired: counts[1],
      noFile: counts[2],
      staleDraft: counts[3],
      longOrphan: counts[4],
      duplicateName,
    }
  }

  /** 파일명 중복 문서 목록 */
  private async getDuplicateNameDocuments(page: number, size: number, userRole: UserRole) {
    const allowedLevels = this.getAllowedLevels(userRole)

    // 중복 파일명 가져오기
    const dupNames = await this.prisma.$queryRaw<Array<{ file_name: string }>>`
      SELECT file_name FROM documents
      WHERE is_deleted = false AND file_name IS NOT NULL
        AND security_level IN (${Prisma.join(allowedLevels)})
      GROUP BY file_name HAVING COUNT(*) > 1
      ORDER BY file_name
      LIMIT ${size} OFFSET ${(page - 1) * size}
    `

    if (dupNames.length === 0) {
      return { data: [], meta: { total: 0, page, size, totalPages: 0 } }
    }

    const names = dupNames.map((r) => r.file_name)
    const data = await this.prisma.document.findMany({
      where: {
        isDeleted: false,
        fileName: { in: names },
        securityLevel: { in: allowedLevels },
      },
      include: { _count: { select: { placements: true } } },
      orderBy: { fileName: 'asc' },
    })

    const totalResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM (
        SELECT file_name FROM documents
        WHERE is_deleted = false AND file_name IS NOT NULL
          AND security_level IN (${Prisma.join(allowedLevels)})
        GROUP BY file_name HAVING COUNT(*) > 1
      ) sub
    `
    const total = Number(totalResult[0]?.count ?? 0)

    return {
      data: data.map((d) => this.formatDocument(d)),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  /** 파일 해시 중복 체크 — documents + document_versions 모두 체크 */
  private async checkFileHashDuplicate(fileHash: string, excludeId?: string) {
    const docWhere: Record<string, unknown> = { fileHash, isDeleted: false }
    if (excludeId) docWhere.id = { not: excludeId }

    const existing = await this.prisma.document.findFirst({
      where: docWhere,
      select: { id: true, docCode: true, fileName: true, securityLevel: true },
    })
    if (existing) return existing

    // document_versions에서도 체크
    const versionMatch = await this.prisma.documentVersion.findFirst({
      where: { fileHash },
      select: {
        document: { select: { id: true, docCode: true, fileName: true, securityLevel: true } },
      },
    })
    return versionMatch?.document ?? null
  }

  /** 버전 이력 목록 */
  async getVersions(docId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, isDeleted: false },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: docId },
      orderBy: [{ versionMajor: 'desc' }, { versionMinor: 'desc' }],
      include: { uploadedBy: { select: { name: true } } },
    })

    return versions.map((v) => ({
      id: v.id,
      documentId: v.documentId,
      versionMajor: v.versionMajor,
      versionMinor: v.versionMinor,
      fileName: v.fileName,
      fileType: v.fileType,
      fileSize: Number(v.fileSize),
      fileHash: v.fileHash,
      uploadedByName: v.uploadedBy?.name ?? null,
      createdAt: v.createdAt.toISOString(),
    }))
  }

  /** 이전 버전 파일 접근 (내부용) */
  async findVersionInternal(docId: string, versionId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, isDeleted: false },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId: docId },
    })
    if (!version) throw new NotFoundException('해당 버전을 찾을 수 없습니다')
    return version
  }

  // ============================================================
  // 감사 로그
  // ============================================================

  /** 문서 열람 기록 (5분 디바운스) */
  async recordView(docId: string, userId: string) {
    const recent = await this.prisma.documentHistory.findFirst({
      where: {
        documentId: docId,
        userId,
        action: 'VIEW',
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    })
    if (recent) return // 5분 이내 중복 기록 방지

    await this.prisma.documentHistory.create({
      data: { documentId: docId, action: 'VIEW', userId },
    })
  }

  /** 문서 다운로드 기록 */
  async recordDownload(docId: string, userId: string) {
    await this.prisma.documentHistory.create({
      data: { documentId: docId, action: 'DOWNLOAD', userId },
    })
  }

  /** 감사 로그 조회 */
  async getAuditLog(query: {
    action?: string
    userId?: string
    dateFrom?: string
    dateTo?: string
    page: number
    size: number
  }) {
    const where: Record<string, unknown> = {}

    if (query.action) where.action = query.action
    if (query.userId) where.userId = query.userId
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo + 'T23:59:59.999Z') }),
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.documentHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.size,
        take: query.size,
        include: {
          document: { select: { fileName: true, docCode: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      this.prisma.documentHistory.count({ where }),
    ])

    return {
      data: data.map((h) => ({
        id: h.id,
        documentId: h.documentId,
        fileName: h.document.fileName,
        docCode: h.document.docCode,
        action: h.action,
        changes: h.changes,
        userId: h.userId,
        userName: h.user?.name ?? null,
        userEmail: h.user?.email ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
      meta: { total, page: query.page, size: query.size, totalPages: Math.ceil(total / query.size) },
    }
  }

  /** 감사 통계 — Top 10 조회 문서 + 사용자별 활동 */
  async getAuditStats() {
    const topViewed = await this.prisma.$queryRaw<Array<{
      document_id: string
      file_name: string | null
      doc_code: string | null
      view_count: bigint
    }>>`
      SELECT dh.document_id, d.file_name, d.doc_code, COUNT(*) as view_count
      FROM document_history dh
      JOIN documents d ON d.id = dh.document_id
      WHERE dh.action = 'VIEW' AND d.is_deleted = false
      GROUP BY dh.document_id, d.file_name, d.doc_code
      ORDER BY view_count DESC
      LIMIT 10
    `

    const userActivity = await this.prisma.$queryRaw<Array<{
      user_id: string
      user_name: string
      action_count: bigint
    }>>`
      SELECT dh.user_id, u.name as user_name, COUNT(*) as action_count
      FROM document_history dh
      JOIN users u ON u.id = dh.user_id
      GROUP BY dh.user_id, u.name
      ORDER BY action_count DESC
      LIMIT 10
    `

    return {
      topViewed: topViewed.map((r) => ({
        documentId: r.document_id,
        fileName: r.file_name,
        docCode: r.doc_code,
        viewCount: Number(r.view_count),
      })),
      userActivity: userActivity.map((r) => ({
        userId: r.user_id,
        userName: r.user_name,
        actionCount: Number(r.action_count),
      })),
    }
  }

  /** 문서 코드 자동 생성: DOC-{YYMM}-{NNN} */
  private async generateDocCode(): Promise<string> {
    const now = new Date()
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`
    const prefix = `DOC-${yymm}-`
    const last = await this.prisma.document.findFirst({
      where: { docCode: { startsWith: prefix } },
      orderBy: { docCode: 'desc' },
      select: { docCode: true },
    })
    const seq = last?.docCode
      ? parseInt(last.docCode.slice(prefix.length), 10) + 1
      : 1
    return `${prefix}${String(seq).padStart(3, '0')}`
  }

  /** API 응답 포맷 */
  private formatDocument(
    doc: {
      id: string
      docCode?: string | null
      lifecycle: string
      securityLevel: string
      fileName: string | null
      fileType: string | null
      fileSize: bigint | null
      filePath?: string | null
      fileHash?: string | null
      versionMajor: number
      versionMinor: number
      reviewedAt: Date | null
      validUntil: Date | null
      rowVersion: number
      createdById: string | null
      createdAt: Date
      updatedAt: Date
      _count?: { sourceRelations?: number; targetRelations?: number; placements?: number }
    },
  ) {
    const relationCount = doc._count
      ? (doc._count.sourceRelations ?? 0) + (doc._count.targetRelations ?? 0)
      : undefined

    const placementCount = doc._count?.placements ?? 0

    return {
      id: doc.id,
      docCode: doc.docCode ?? null,
      lifecycle: doc.lifecycle,
      securityLevel: doc.securityLevel,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: Number(doc.fileSize ?? 0),
      fileHash: doc.fileHash ?? null,
      downloadUrl: doc.filePath ? `/api/documents/${doc.id}/file` : null,
      versionMajor: doc.versionMajor,
      versionMinor: doc.versionMinor,
      reviewedAt: doc.reviewedAt?.toISOString() ?? null,
      validUntil: doc.validUntil?.toISOString() ?? null,
      rowVersion: doc.rowVersion,
      createdBy: doc.createdById,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      freshness: this.calcFreshness(doc),
      placementCount,
      ...(relationCount !== undefined && { relationCount }),
    }
  }

  private calcFreshness(doc: {
    lifecycle: string
    reviewedAt: Date | null
    validUntil: Date | null
    updatedAt: Date
  }): Freshness | null {
    if (doc.lifecycle !== 'ACTIVE') return null

    if (doc.validUntil) {
      const daysUntilExpiry = (doc.validUntil.getTime() - Date.now()) / 86400000
      if (daysUntilExpiry < 0) return 'EXPIRED'
      if (daysUntilExpiry < FRESHNESS_THRESHOLDS.HOT) return 'WARNING'
      return 'FRESH'
    }

    const baseDate = doc.reviewedAt ?? doc.updatedAt
    const daysSince = Math.floor(
      (Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysSince < FRESHNESS_THRESHOLDS.HOT) return 'FRESH'
    if (daysSince < FRESHNESS_THRESHOLDS.WARM) return 'WARNING'
    return 'EXPIRED'
  }
}
