import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
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

type IssueType = 'warning' | 'expired' | 'no_file' | 'stale_draft'

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  /** 역할별 접근 가능 보안등급 목록 */
  private getAllowedLevels(userRole: UserRole): string[] {
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    return Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)
  }

  /** 이슈 유형별 Prisma where 조건 빌더 (validUntil 또는 reviewedAt ?? updatedAt 기준) */
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
        // WARNING: validUntil 30일 이내 OR 기존 시간 기반 로직
        return {
          ...baseWhere,
          lifecycle: 'ACTIVE',
          OR: [
            // validUntil 기준: 아직 만료되지 않았지만 HOT일 이내
            { validUntil: { gte: now, lt: hotFromNow } },
            // 기존 로직: validUntil 없는 문서
            { validUntil: null, reviewedAt: { lt: hotDate, gte: warmDate } },
            { validUntil: null, reviewedAt: null, updatedAt: { lt: hotDate, gte: warmDate } },
          ],
        }
      case 'expired':
        // EXPIRED: validUntil 지남 OR 기존 시간 기반 로직
        return {
          ...baseWhere,
          lifecycle: 'ACTIVE',
          OR: [
            // validUntil 기준: 이미 만료
            { validUntil: { lt: now } },
            // 기존 로직: validUntil 없는 문서
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
    }
  }

  async create(
    data: {
      domain: string
      classifications: Record<string, string>
      securityLevel?: SecurityLevel
      lifecycle?: Lifecycle
      title?: string
      validUntil?: string
    },
    file: Express.Multer.File | null,
    userId: string,
  ) {
    await this.taxonomy.validateDomain(data.domain)
    await this.taxonomy.validateClassifications(data.domain, data.classifications)

    let filePath: string | null = null
    let fileName: string | null = null
    let fileType: string | null = null
    let fileSize: number = 0

    if (file) {
      // multer가 latin1로 디코딩하는 파일명을 UTF-8로 복원
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
      const ext = originalName.split('.').pop()?.toLowerCase()
      if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
        throw new BadRequestException('허용되지 않는 파일 형식입니다')
      }
      filePath = file.path
      fileName = originalName
      fileType = ext
      fileSize = file.size
    } else if (data.title) {
      fileName = data.title
    }

    const lifecycle = data.lifecycle ?? 'ACTIVE'

    // ACTIVE로 생성 시 동일 분류의 기존 ACTIVE 문서를 자동 만료
    let supersededDocId: string | null = null
    if (lifecycle === 'ACTIVE' && Object.keys(data.classifications).length > 0) {
      supersededDocId = await this.autoDeprecateExisting(data.domain, data.classifications, userId)
    }

    // 문서 코드(채번) 자동 생성 — 동시성 충돌 시 1회 재시도
    const createDocument = async (docCode: string) =>
      this.prisma.document.create({
        data: {
          domain: data.domain,
          docCode,
          lifecycle,
          securityLevel: data.securityLevel ?? 'INTERNAL',
          filePath,
          fileName,
          fileType,
          fileSize,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
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

    let document: Awaited<ReturnType<typeof createDocument>>
    try {
      document = await createDocument(await this.generateDocCode(data.domain))
    } catch (error: unknown) {
      const isUniqueViolation = typeof error === 'object' && error !== null
        && 'code' in error && (error as { code: string }).code === 'P2002'
      if (!isUniqueViolation) throw error
      // 동시성 충돌 — 코드 재생성 후 재시도
      document = await createDocument(await this.generateDocCode(data.domain))
    }

    // 대체 관계 자동 생성
    if (supersededDocId) {
      await this.prisma.relation.create({
        data: {
          sourceId: document.id,
          targetId: supersededDocId,
          relationType: 'SUPERSEDES',
        },
      })
    }

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
    const { domain, lifecycle, securityLevel, classifications, page = 1, size = 20, sort = 'createdAt', order = 'desc' } = query

    // 보안 등급 필터: 사용자 역할에 따라 접근 가능한 문서만
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    // securityLevel이 지정된 경우, 사용자 접근 가능 범위와 교차 검증
    const effectiveSecurityLevel = securityLevel && allowedLevels.includes(securityLevel)
      ? { equals: securityLevel }
      : { in: allowedLevels }

    // 동적 facet 필터: classifications JSON → AND 조건
    let parsed: Record<string, string> = {}
    if (classifications) {
      try {
        const raw: unknown = JSON.parse(classifications)
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
          parsed = raw as Record<string, string>
        }
      } catch {
        throw new BadRequestException('classifications는 유효한 JSON이어야 합니다')
      }
    }
    const facetFilters = Object.entries(parsed).map(([type, value]) => ({
      classifications: { some: { facetType: type, facetValue: String(value) } },
    }))

    const where = {
      isDeleted: false,
      ...(domain && { domain }),
      ...(lifecycle && { lifecycle }),
      securityLevel: effectiveSecurityLevel,
      ...(facetFilters.length > 0 && { AND: facetFilters }),
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
      data: data.map((d: Parameters<DocumentsService['formatDocument']>[0]) => this.formatDocument(d)),
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

  async attachFile(id: string, file: Express.Multer.File, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const ext = originalName.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다')
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        filePath: file.path,
        fileName: originalName,
        fileType: ext,
        fileSize: file.size,
        updatedBy: { connect: { id: userId } },
      },
      include: { classifications: true },
    })

    await this.prisma.documentHistory.create({
      data: {
        documentId: id,
        action: 'FILE_ATTACH',
        changes: { fileName: originalName, fileType: ext },
        userId,
      },
    })

    return this.formatDocument(updated)
  }

  async update(
    id: string,
    data: {
      classifications?: Record<string, string>
      securityLevel?: SecurityLevel
      validUntil?: string | null
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
    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          ...(data.validUntil !== undefined && {
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
          }),
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
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    const where = { isDeleted: false, securityLevel: { in: allowedLevels } }

    const [total, active, draft, deprecated] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.count({ where: { ...where, lifecycle: 'ACTIVE' } }),
      this.prisma.document.count({ where: { ...where, lifecycle: 'DRAFT' } }),
      this.prisma.document.count({ where: { ...where, lifecycle: 'DEPRECATED' } }),
    ])

    // 도메인별 통계
    const domains = await this.prisma.domainMaster.findMany({ where: { isActive: true } })
    const byDomain = await Promise.all(
      domains.map(async (d: { code: string; displayName: string }) => {
        const dWhere = { ...where, domain: d.code }
        const [dTotal, dActive, dDraft, dDeprecated] = await Promise.all([
          this.prisma.document.count({ where: dWhere }),
          this.prisma.document.count({ where: { ...dWhere, lifecycle: 'ACTIVE' } }),
          this.prisma.document.count({ where: { ...dWhere, lifecycle: 'DRAFT' } }),
          this.prisma.document.count({ where: { ...dWhere, lifecycle: 'DEPRECATED' } }),
        ])
        return {
          domain: d.code,
          displayName: d.displayName,
          total: dTotal,
          active: dActive,
          draft: dDraft,
          deprecated: dDeprecated,
          warning: 0, // 신선도 경고는 별도 계산 필요
        }
      }),
    )

    return {
      total,
      active,
      draft,
      deprecated,
      freshnessWarning: 0,
      byDomain,
    }
  }

  async getRecent(limit: number, userRole: UserRole) {
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    const histories = await this.prisma.documentHistory.findMany({
      take: Math.min(limit, 50),
      orderBy: { createdAt: 'desc' },
      include: {
        document: { select: { fileName: true, domain: true, securityLevel: true, isDeleted: true } },
        user: { select: { name: true } },
      },
    })

    return histories
      .filter((h: { document: { isDeleted: boolean; securityLevel: string } }) =>
        !h.document.isDeleted && allowedLevels.includes(h.document.securityLevel),
      )
      .map((h: {
        id: string; documentId: string; action: string; changes: unknown;
        createdAt: Date; document: { fileName: string | null; domain: string };
        user: { name: string } | null;
      }) => ({
        id: h.id,
        documentId: h.documentId,
        fileName: h.document.fileName,
        domain: h.document.domain,
        action: h.action,
        changes: h.changes as Record<string, unknown> | null,
        userName: h.user?.name ?? null,
        createdAt: h.createdAt.toISOString(),
      }))
  }

  async getCounts(domain: string, groupBy: string, userRole: UserRole) {
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    const docs = await this.prisma.document.findMany({
      where: {
        domain,
        isDeleted: false,
        securityLevel: { in: allowedLevels },
      },
      include: { classifications: true },
    })

    const counts: Record<string, number> = {}
    for (const doc of docs) {
      const classification = doc.classifications.find((c: { facetType: string; facetValue: string }) => c.facetType === groupBy)
      if (classification) {
        counts[classification.facetValue] = (counts[classification.facetValue] ?? 0) + 1
      }
    }
    return counts
  }

  async search(
    params: { q?: string; domain?: string; lifecycle?: string; classifications?: string; page: number; size: number },
    userRole: UserRole,
  ) {
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    const { q, domain, lifecycle, classifications, page = 1, size = 20 } = params

    // 분류 필터 파싱
    let facetFilters: Array<{ classifications: { some: { facetType: string; facetValue: string } } }> = []
    if (classifications) {
      try {
        const raw: unknown = JSON.parse(classifications)
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
          facetFilters = Object.entries(raw as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string' && v !== '')
            .map(([type, value]) => ({
              classifications: { some: { facetType: type, facetValue: value as string } },
            }))
        }
      } catch { /* 잘못된 JSON은 필터 없이 검색 */ }
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
      ...(domain && { domain }),
      ...(lifecycle && { lifecycle }),
      ...(facetFilters.length > 0 && { AND: facetFilters }),
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { classifications: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.document.count({ where }),
    ])

    return {
      data: data.map((d: Parameters<DocumentsService['formatDocument']>[0]) => this.formatDocument(d)),
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

    return history.map((h: { id: string; action: string; changes: unknown; createdAt: Date; user: { name: string } | null }) => ({
      id: h.id,
      action: h.action,
      changes: h.changes as Record<string, unknown> | null,
      userName: h.user?.name ?? null,
      createdAt: h.createdAt.toISOString(),
    }))
  }

  async getIssueDocuments(
    type: IssueType,
    page: number,
    size: number,
    userRole: UserRole,
  ) {
    const where = this.buildIssueWhere(type, this.getAllowedLevels(userRole))

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { classifications: true },
        orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.document.count({ where }),
    ])

    return {
      data: data.map((d: Parameters<DocumentsService['formatDocument']>[0]) => this.formatDocument(d)),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  async getIssueCounts(userRole: UserRole) {
    const allowedLevels = this.getAllowedLevels(userRole)
    const issueTypes: IssueType[] = ['warning', 'expired', 'no_file', 'stale_draft']

    const [warning, expired, noFile, staleDraft] = await Promise.all(
      issueTypes.map((t) => this.prisma.document.count({ where: this.buildIssueWhere(t, allowedLevels) })),
    )

    return { warning, expired, noFile, staleDraft }
  }

  /** 동일 분류의 기존 ACTIVE 문서를 조회 (중복 체크용) */
  async checkDuplicate(domain: string, classifications: Record<string, string>, userRole: UserRole) {
    const allowedLevels = this.getAllowedLevels(userRole)
    const facetFilters = Object.entries(classifications).map(([type, value]) => ({
      classifications: { some: { facetType: type, facetValue: value } },
    }))

    if (facetFilters.length === 0) return null

    const existing = await this.prisma.document.findFirst({
      where: {
        domain,
        lifecycle: 'ACTIVE',
        isDeleted: false,
        securityLevel: { in: allowedLevels },
        AND: facetFilters,
      },
      include: { classifications: true },
    })

    return existing ? this.formatDocument(existing) : null
  }

  /** 동일 분류의 기존 ACTIVE 문서를 자동 만료 처리 */
  private async autoDeprecateExisting(
    domain: string,
    classifications: Record<string, string>,
    userId: string,
  ): Promise<string | null> {
    const facetFilters = Object.entries(classifications).map(([type, value]) => ({
      classifications: { some: { facetType: type, facetValue: value } },
    }))

    if (facetFilters.length === 0) return null

    const existingDocs = await this.prisma.document.findMany({
      where: {
        domain,
        lifecycle: 'ACTIVE',
        isDeleted: false,
        AND: facetFilters,
      },
    })

    if (existingDocs.length === 0) return null

    for (const existing of existingDocs) {
      await this.prisma.document.update({
        where: { id: existing.id },
        data: { lifecycle: 'DEPRECATED', updatedById: userId },
      })

      await this.prisma.documentHistory.create({
        data: {
          documentId: existing.id,
          action: 'LIFECYCLE_CHANGE',
          changes: { from: 'ACTIVE', to: 'DEPRECATED', reason: 'auto_superseded' },
          userId,
        },
      })
    }

    // 가장 최근 문서의 ID를 반환 (SUPERSEDES 관계용)
    return existingDocs[0].id
  }

  /** 문서 코드 자동 생성: {도메인코드}-{YYMM}-{NNN} */
  private async generateDocCode(domain: string): Promise<string> {
    const now = new Date()
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`
    const prefix = `${domain}-${yymm}-`
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

  /** API 응답 포맷 (filePath 미노출, downloadUrl 제공) */
  private formatDocument(
    doc: {
      id: string
      docCode?: string | null
      domain: string
      lifecycle: string
      securityLevel: string
      fileName: string | null
      fileType: string | null
      fileSize: bigint | null
      filePath?: string | null
      versionMajor: number
      versionMinor: number
      classificationHash: string | null
      reviewedAt: Date | null
      validUntil: Date | null
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
      docCode: doc.docCode ?? null,
      domain: doc.domain,
      lifecycle: doc.lifecycle,
      securityLevel: doc.securityLevel,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: Number(doc.fileSize ?? 0),
      downloadUrl: doc.filePath ? `/api/documents/${doc.id}/file` : null,
      versionMajor: doc.versionMajor,
      versionMinor: doc.versionMinor,
      classificationHash: doc.classificationHash,
      reviewedAt: doc.reviewedAt?.toISOString() ?? null,
      validUntil: doc.validUntil?.toISOString() ?? null,
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
    validUntil: Date | null
    updatedAt: Date
  }): Freshness | null {
    if (doc.lifecycle !== 'ACTIVE') return null

    // validUntil이 설정된 경우: 만료일까지 남은 일수 기준
    if (doc.validUntil) {
      const daysUntilExpiry = (doc.validUntil.getTime() - Date.now()) / 86400000
      if (daysUntilExpiry < 0) return 'EXPIRED'
      if (daysUntilExpiry < FRESHNESS_THRESHOLDS.HOT) return 'WARNING'
      return 'FRESH'
    }

    // validUntil 없으면: 기존 reviewedAt ?? updatedAt 기반 로직 유지
    const baseDate = doc.reviewedAt ?? doc.updatedAt
    const daysSince = Math.floor(
      (Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysSince < FRESHNESS_THRESHOLDS.HOT) return 'FRESH'
    if (daysSince < FRESHNESS_THRESHOLDS.WARM) return 'WARNING'
    return 'EXPIRED'
  }
}
