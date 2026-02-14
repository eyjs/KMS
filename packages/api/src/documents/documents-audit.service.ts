import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { DocumentsQueryService } from './documents-query.service'
import type { UserRole } from '@kms/shared'

@Injectable()
export class DocumentsAuditService {
  private static readonly VIEW_DEBOUNCE_MS = 5 * 60 * 1000 // 5분

  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: DocumentsQueryService,
  ) {}

  async getRecent(limit: number, userRole: UserRole) {
    const allowedLevels = this.queryService.getAllowedLevels(userRole)

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

  async getHistory(id: string) {
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

  /** 문서 열람 기록 (디바운스) */
  async recordView(docId: string, userId: string) {
    const recent = await this.prisma.documentHistory.findFirst({
      where: {
        documentId: docId,
        userId,
        action: 'VIEW',
        createdAt: { gte: new Date(Date.now() - DocumentsAuditService.VIEW_DEBOUNCE_MS) },
      },
    })
    if (recent) return

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

  /** 감사 통계 */
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
}
