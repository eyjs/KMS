import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CategoriesService } from '../categories/categories.service'
import { DocumentsQueryService } from './documents-query.service'
import { RELATION_DIRECTION_LABELS } from '@kms/shared'
import type { UserRole, RelationType, RelationsResponse, RelationGroup, RelatedDocumentSummary } from '@kms/shared'

/** 인증된 사용자 정보 */
interface AuthUser {
  sub: string
  role: UserRole
  isApiKey?: boolean
  groupIds?: string[]
}

@Injectable()
export class DocumentsRelationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly queryService: DocumentsQueryService,
  ) {}

  /**
   * 연관 문서 조회 — 관계 유형별 그룹화 + 권한 필터링
   */
  async findRelatedDocuments(
    documentId: string,
    userRole: UserRole,
    authUser: AuthUser | undefined,
    options: {
      depth?: number
      types?: RelationType[]
      limit?: number
      currentDepth?: number
    } = {},
  ): Promise<RelationsResponse> {
    const { depth = 1, types, limit = 50, currentDepth = 0 } = options
    const allowedLevels = this.queryService.getAllowedLevels(userRole)
    const maxDepth = Math.min(depth, 3)

    const typeFilter = types && types.length > 0
      ? { relationType: { in: types } }
      : {}

    // outgoing 관계 (sourceId = documentId)
    const outgoingRelations = await this.prisma.relation.findMany({
      where: {
        sourceId: documentId,
        ...typeFilter,
        target: { isDeleted: false, securityLevel: { in: allowedLevels } },
      },
      include: {
        target: {
          select: {
            id: true,
            docCode: true,
            fileName: true,
            fileType: true,
            filePath: true,
            lifecycle: true,
            securityLevel: true,
            versionMajor: true,
            versionMinor: true,
            reviewedAt: true,
            validUntil: true,
            updatedAt: true,
            placements: { select: { categoryId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // incoming 관계 (targetId = documentId)
    const incomingRelations = await this.prisma.relation.findMany({
      where: {
        targetId: documentId,
        ...typeFilter,
        source: { isDeleted: false, securityLevel: { in: allowedLevels } },
      },
      include: {
        source: {
          select: {
            id: true,
            docCode: true,
            fileName: true,
            fileType: true,
            filePath: true,
            lifecycle: true,
            securityLevel: true,
            versionMajor: true,
            versionMinor: true,
            reviewedAt: true,
            validUntil: true,
            updatedAt: true,
            placements: { select: { categoryId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // API Key 폴더 권한 필터
    const filterByFolderAccess = async <T extends { placements: Array<{ categoryId: number | null }> }>(
      docs: T[],
    ): Promise<T[]> => {
      if (!authUser?.isApiKey || !authUser.groupIds || authUser.groupIds.length === 0) {
        return docs
      }
      const accessibleFolderIds = await this.categoriesService.getAccessibleFolderIds(authUser.groupIds)
      return docs.filter((d) =>
        d.placements.some((p) => p.categoryId && accessibleFolderIds.includes(p.categoryId)),
      )
    }

    const groupMap = new Map<string, RelationGroup>()
    let totalCount = 0
    let returnedCount = 0
    let hasMore = false

    // outgoing 처리
    const outgoingByType = new Map<string, Array<typeof outgoingRelations[0]>>()
    for (const rel of outgoingRelations) {
      const list = outgoingByType.get(rel.relationType) ?? []
      list.push(rel)
      outgoingByType.set(rel.relationType, list)
    }

    for (const [relType, relations] of outgoingByType.entries()) {
      const docs = relations.map((r) => r.target)
      const filteredDocs = await filterByFolderAccess(docs)

      totalCount += docs.length
      const limitedDocs = filteredDocs.slice(0, limit)
      returnedCount += limitedDocs.length
      if (filteredDocs.length > limit) hasMore = true

      const labels = RELATION_DIRECTION_LABELS[relType]
      const relatedSummaries: RelatedDocumentSummary[] = []

      for (const d of limitedDocs) {
        const summary: RelatedDocumentSummary = {
          id: d.id,
          docCode: d.docCode,
          fileName: d.fileName,
          fileType: d.fileType as RelatedDocumentSummary['fileType'],
          lifecycle: d.lifecycle as RelatedDocumentSummary['lifecycle'],
          securityLevel: d.securityLevel as RelatedDocumentSummary['securityLevel'],
          downloadUrl: d.filePath ? `/api/documents/${d.id}/file` : null,
          versionMajor: d.versionMajor,
          versionMinor: d.versionMinor,
          freshness: this.queryService.calcFreshness({
            lifecycle: d.lifecycle,
            reviewedAt: d.reviewedAt,
            validUntil: d.validUntil,
            updatedAt: d.updatedAt,
          }),
        }

        if (currentDepth + 1 < maxDepth) {
          summary.relations = await this.findRelatedDocuments(d.id, userRole, authUser, {
            depth: maxDepth,
            types,
            limit,
            currentDepth: currentDepth + 1,
          })
        }

        relatedSummaries.push(summary)
      }

      if (relatedSummaries.length > 0) {
        groupMap.set(`${relType}_outgoing`, {
          relationType: relType as RelationType,
          label: labels?.outgoing ?? relType,
          direction: 'outgoing',
          documents: relatedSummaries,
        })
      }
    }

    // incoming 처리
    const incomingByType = new Map<string, Array<typeof incomingRelations[0]>>()
    for (const rel of incomingRelations) {
      const list = incomingByType.get(rel.relationType) ?? []
      list.push(rel)
      incomingByType.set(rel.relationType, list)
    }

    for (const [relType, relations] of incomingByType.entries()) {
      const docs = relations.map((r) => r.source)
      const filteredDocs = await filterByFolderAccess(docs)

      totalCount += docs.length
      const limitedDocs = filteredDocs.slice(0, limit)
      returnedCount += limitedDocs.length
      if (filteredDocs.length > limit) hasMore = true

      const labels = RELATION_DIRECTION_LABELS[relType]
      const relatedSummaries: RelatedDocumentSummary[] = []

      for (const d of limitedDocs) {
        const summary: RelatedDocumentSummary = {
          id: d.id,
          docCode: d.docCode,
          fileName: d.fileName,
          fileType: d.fileType as RelatedDocumentSummary['fileType'],
          lifecycle: d.lifecycle as RelatedDocumentSummary['lifecycle'],
          securityLevel: d.securityLevel as RelatedDocumentSummary['securityLevel'],
          downloadUrl: d.filePath ? `/api/documents/${d.id}/file` : null,
          versionMajor: d.versionMajor,
          versionMinor: d.versionMinor,
          freshness: this.queryService.calcFreshness({
            lifecycle: d.lifecycle,
            reviewedAt: d.reviewedAt,
            validUntil: d.validUntil,
            updatedAt: d.updatedAt,
          }),
        }

        if (currentDepth + 1 < maxDepth) {
          summary.relations = await this.findRelatedDocuments(d.id, userRole, authUser, {
            depth: maxDepth,
            types,
            limit,
            currentDepth: currentDepth + 1,
          })
        }

        relatedSummaries.push(summary)
      }

      if (relatedSummaries.length > 0) {
        groupMap.set(`${relType}_incoming`, {
          relationType: relType as RelationType,
          label: labels?.incoming ?? relType,
          direction: 'incoming',
          documents: relatedSummaries,
        })
      }
    }

    return {
      totalCount,
      returnedCount,
      hasMore,
      byType: [...groupMap.values()],
    }
  }
}
