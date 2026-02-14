import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { FRESHNESS_THRESHOLDS, SECURITY_LEVEL_ORDER } from '@kms/shared'
import type { Lifecycle, SecurityLevel, UserRole, Freshness, DocumentListQuery } from '@kms/shared'

type IssueType = 'warning' | 'expired' | 'no_file' | 'stale_draft' | 'long_orphan' | 'duplicate_name'

@Injectable()
export class DocumentsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 역할별 접근 가능 보안등급 목록 */
  getAllowedLevels(userRole: UserRole): string[] {
    const levelOrder: Record<string, number> = {
      VIEWER: 0,
      EDITOR: 1,
      REVIEWER: 2,
      APPROVER: 3,
      ADMIN: 4,
    }
    const maxLevel = levelOrder[userRole] ?? 0
    return Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)
  }

  async findAll(query: DocumentListQuery, userRole: UserRole) {
    const {
      domain, lifecycle, securityLevel, fileType, orphan,
      createdFrom, createdTo, updatedFrom, updatedTo,
      page = 1, size = 20, sort = 'createdAt', order = 'desc',
    } = query

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

    // 날짜 범위 필터
    const createdAtFilter = (createdFrom || createdTo) ? {
      createdAt: {
        ...(createdFrom && { gte: new Date(createdFrom) }),
        ...(createdTo && { lte: new Date(createdTo + 'T23:59:59.999Z') }),
      },
    } : {}

    const updatedAtFilter = (updatedFrom || updatedTo) ? {
      updatedAt: {
        ...(updatedFrom && { gte: new Date(updatedFrom) }),
        ...(updatedTo && { lte: new Date(updatedTo + 'T23:59:59.999Z') }),
      },
    } : {}

    const where = {
      isDeleted: false,
      ...domainFilter,
      ...orphanFilter,
      ...createdAtFilter,
      ...updatedAtFilter,
      ...(lifecycle && { lifecycle }),
      ...(fileType && { fileType }),
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

  async search(
    params: {
      q?: string
      domain?: string
      lifecycle?: string
      fileType?: string
      orphan?: boolean
      createdFrom?: string
      createdTo?: string
      updatedFrom?: string
      updatedTo?: string
      page: number
      size: number
    },
    userRole: UserRole,
  ) {
    const allowedLevels = this.getAllowedLevels(userRole)
    const {
      q, domain, lifecycle, fileType, orphan,
      createdFrom, createdTo, updatedFrom, updatedTo,
      page = 1, size = 20,
    } = params

    let domainFilter = {}
    if (domain) {
      domainFilter = { placements: { some: { domainCode: domain } } }
    }

    let orphanFilter = {}
    if (orphan) {
      orphanFilter = { placements: { none: {} } }
    }

    const keywordFilter = q ? {
      OR: [
        { fileName: { contains: q, mode: 'insensitive' as const } },
        { docCode: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {}

    const createdAtFilter = (createdFrom || createdTo) ? {
      createdAt: {
        ...(createdFrom && { gte: new Date(createdFrom) }),
        ...(createdTo && { lte: new Date(createdTo + 'T23:59:59.999Z') }),
      },
    } : {}

    const updatedAtFilter = (updatedFrom || updatedTo) ? {
      updatedAt: {
        ...(updatedFrom && { gte: new Date(updatedFrom) }),
        ...(updatedTo && { lte: new Date(updatedTo + 'T23:59:59.999Z') }),
      },
    } : {}

    const where = {
      isDeleted: false,
      securityLevel: { in: allowedLevels },
      ...keywordFilter,
      ...domainFilter,
      ...orphanFilter,
      ...createdAtFilter,
      ...updatedAtFilter,
      ...(lifecycle && { lifecycle }),
      ...(fileType && { fileType }),
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

    const domains = await this.prisma.domainMaster.findMany({ where: { isActive: true } })
    const byDomain = await Promise.all(
      domains.map(async (d: { code: string; displayName: string }) => {
        const dWhere = { ...where, placements: { some: { domainCode: d.code } } }
        const dTotal = await this.prisma.document.count({ where: dWhere })
        return { domain: d.code, displayName: d.displayName, total: dTotal }
      }),
    )

    return { total, active, draft, deprecated, orphan, byDomain }
  }

  /** 이슈 유형별 Prisma where 조건 빌더 */
  private buildIssueWhere(type: IssueType, allowedLevels: string[]) {
    const baseWhere = { isDeleted: false, securityLevel: { in: allowedLevels } }
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
        return { ...baseWhere, filePath: null, lifecycle: { not: 'DEPRECATED' } }
      case 'stale_draft':
        return { ...baseWhere, lifecycle: 'DRAFT', updatedAt: { lt: new Date(Date.now() - 30 * 86400000) } }
      case 'long_orphan':
        return {
          ...baseWhere,
          placements: { none: {} },
          lifecycle: { not: 'DEPRECATED' },
          createdAt: { lt: new Date(Date.now() - 30 * 86400000) },
        }
      case 'duplicate_name':
        return baseWhere
    }
  }

  async getIssueDocuments(type: IssueType, page: number, size: number, userRole: UserRole) {
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

  private async getDuplicateNameDocuments(page: number, size: number, userRole: UserRole) {
    const allowedLevels = this.getAllowedLevels(userRole)

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
      where: { isDeleted: false, fileName: { in: names }, securityLevel: { in: allowedLevels } },
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

  /** API 응답 포맷 */
  formatDocument(
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

  calcFreshness(doc: {
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
    const daysSince = Math.floor((Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSince < FRESHNESS_THRESHOLDS.HOT) return 'FRESH'
    if (daysSince < FRESHNESS_THRESHOLDS.WARM) return 'WARNING'
    return 'EXPIRED'
  }
}
