import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CategoriesService } from '../categories/categories.service'
import { SECURITY_LEVEL_ORDER } from '@kms/shared'
import type {
  RelationType,
  UserRole,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraphResponse,
} from '@kms/shared'

/** 인증된 사용자 정보 */
interface AuthUser {
  sub: string
  role: UserRole
  isApiKey?: boolean
  groupIds?: string[]
}

@Injectable()
export class KnowledgeGraphService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * BFS 기반 지식그래프 탐색
   * 시작 문서에서 depth 홉까지 연결된 모든 문서와 관계를 반환
   */
  async explore(
    startId: string,
    userRole: UserRole,
    authUser: AuthUser | undefined,
    options: {
      depth?: number
      relationTypes?: RelationType[]
      maxNodes?: number
    } = {},
  ): Promise<KnowledgeGraphResponse> {
    const { depth = 1, relationTypes, maxNodes = 100 } = options
    const maxDepth = Math.min(depth, 3)

    // 시작 문서 확인
    const startDoc = await this.prisma.document.findFirst({
      where: { id: startId, isDeleted: false },
    })
    if (!startDoc) {
      throw new NotFoundException('시작 문서를 찾을 수 없습니다')
    }

    const allowedLevels = this.getAllowedLevels(userRole)

    // API Key 폴더 권한
    let accessibleFolderIds: number[] | null = null
    if (authUser?.isApiKey && authUser.groupIds && authUser.groupIds.length > 0) {
      accessibleFolderIds = await this.categoriesService.getAccessibleFolderIds(authUser.groupIds)
    }

    // BFS 탐색
    const nodeMap = new Map<string, KnowledgeGraphNode>()
    const edgeMap = new Map<string, KnowledgeGraphEdge>()
    const visited = new Set<string>()
    const queue: Array<{ docId: string; currentDepth: number }> = [{ docId: startId, currentDepth: 0 }]

    while (queue.length > 0 && nodeMap.size < maxNodes) {
      const { docId, currentDepth } = queue.shift()!

      if (visited.has(docId)) continue
      visited.add(docId)

      // 문서 정보 조회
      const doc = await this.prisma.document.findFirst({
        where: { id: docId, isDeleted: false },
        include: { placements: { select: { categoryId: true } } },
      })

      if (!doc) continue

      // 권한 체크
      const canAccess = allowedLevels.includes(doc.securityLevel)
      const folderAccessible = accessibleFolderIds === null ||
        doc.placements.some((p) => p.categoryId && accessibleFolderIds!.includes(p.categoryId))
      const accessible = canAccess && folderAccessible

      // 노드 추가
      nodeMap.set(docId, {
        id: doc.id,
        docCode: doc.docCode,
        fileName: accessible ? doc.fileName : null,
        fileType: accessible ? (doc.fileType as KnowledgeGraphNode['fileType']) : null,
        lifecycle: doc.lifecycle as KnowledgeGraphNode['lifecycle'],
        securityLevel: doc.securityLevel as KnowledgeGraphNode['securityLevel'],
        depth: currentDepth,
        accessible,
      })

      // depth 제한 내에서만 관계 탐색
      if (currentDepth < maxDepth) {
        const typeFilter = relationTypes && relationTypes.length > 0
          ? { relationType: { in: relationTypes } }
          : {}

        // outgoing 관계
        const outgoingRelations = await this.prisma.relation.findMany({
          where: { sourceId: docId, ...typeFilter },
          select: { id: true, targetId: true, relationType: true, domainCode: true },
        })

        for (const rel of outgoingRelations) {
          if (!edgeMap.has(rel.id)) {
            edgeMap.set(rel.id, {
              id: rel.id,
              sourceId: docId,
              targetId: rel.targetId,
              relationType: rel.relationType as RelationType,
              domainCode: rel.domainCode,
            })
          }
          if (!visited.has(rel.targetId) && nodeMap.size < maxNodes) {
            queue.push({ docId: rel.targetId, currentDepth: currentDepth + 1 })
          }
        }

        // incoming 관계
        const incomingRelations = await this.prisma.relation.findMany({
          where: { targetId: docId, ...typeFilter },
          select: { id: true, sourceId: true, relationType: true, domainCode: true },
        })

        for (const rel of incomingRelations) {
          if (!edgeMap.has(rel.id)) {
            edgeMap.set(rel.id, {
              id: rel.id,
              sourceId: rel.sourceId,
              targetId: docId,
              relationType: rel.relationType as RelationType,
              domainCode: rel.domainCode,
            })
          }
          if (!visited.has(rel.sourceId) && nodeMap.size < maxNodes) {
            queue.push({ docId: rel.sourceId, currentDepth: currentDepth + 1 })
          }
        }
      }
    }

    const nodes = [...nodeMap.values()]
    const edges = [...edgeMap.values()].filter(
      (e) => nodeMap.has(e.sourceId) && nodeMap.has(e.targetId),
    )

    return {
      nodes,
      edges,
      meta: {
        startId,
        maxDepth,
        totalNodes: nodes.length,
        accessibleNodes: nodes.filter((n) => n.accessible).length,
      },
    }
  }

  /**
   * 두 문서 간 최단 경로 탐색
   */
  async findPath(
    fromId: string,
    toId: string,
    userRole: UserRole,
    maxDepth: number = 5,
  ): Promise<{ path: string[]; relations: KnowledgeGraphEdge[] } | null> {
    const allowedLevels = this.getAllowedLevels(userRole)

    // 양방향 BFS
    const visited = new Map<string, { from: string | null; edge: KnowledgeGraphEdge | null }>()
    const queue: Array<{ docId: string; depth: number }> = [{ docId: fromId, depth: 0 }]
    visited.set(fromId, { from: null, edge: null })

    while (queue.length > 0) {
      const { docId, depth } = queue.shift()!

      if (docId === toId) {
        // 경로 역추적
        const path: string[] = []
        const relations: KnowledgeGraphEdge[] = []
        let current: string | null = toId

        while (current) {
          path.unshift(current)
          const prev = visited.get(current)
          if (prev?.edge) relations.unshift(prev.edge)
          current = prev?.from ?? null
        }

        return { path, relations }
      }

      if (depth >= maxDepth) continue

      // 관계 탐색
      const relations = await this.prisma.relation.findMany({
        where: {
          OR: [{ sourceId: docId }, { targetId: docId }],
        },
        include: {
          source: { select: { id: true, securityLevel: true, isDeleted: true } },
          target: { select: { id: true, securityLevel: true, isDeleted: true } },
        },
      })

      for (const rel of relations) {
        const neighborId = rel.sourceId === docId ? rel.targetId : rel.sourceId
        const neighbor = rel.sourceId === docId ? rel.target : rel.source

        if (
          neighbor.isDeleted ||
          !allowedLevels.includes(neighbor.securityLevel) ||
          visited.has(neighborId)
        ) {
          continue
        }

        visited.set(neighborId, {
          from: docId,
          edge: {
            id: rel.id,
            sourceId: rel.sourceId,
            targetId: rel.targetId,
            relationType: rel.relationType as RelationType,
            domainCode: rel.domainCode,
          },
        })
        queue.push({ docId: neighborId, depth: depth + 1 })
      }
    }

    return null
  }

  /** 역할별 접근 가능 보안등급 목록 */
  private getAllowedLevels(userRole: UserRole): string[] {
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
}
