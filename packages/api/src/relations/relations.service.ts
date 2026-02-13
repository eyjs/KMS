import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SecurityLevelGuard } from '../auth/guards/security-level.guard'
import { RELATION_META, SECURITY_LEVEL_ORDER } from '@kms/shared'
import type { RelationType, UserRole, SecurityLevel, GraphNode, GraphEdge, GlobalGraphResponse } from '@kms/shared'

@Injectable()
export class RelationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findByDocument(documentId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, isDeleted: false },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const [asSource, asTarget] = await Promise.all([
      this.prisma.relation.findMany({
        where: { sourceId: documentId },
        include: {
          target: { select: { id: true, fileName: true, lifecycle: true, securityLevel: true } },
        },
      }),
      this.prisma.relation.findMany({
        where: { targetId: documentId },
        include: {
          source: { select: { id: true, fileName: true, lifecycle: true, securityLevel: true } },
        },
      }),
    ])

    const filteredSource = asSource.filter((r: { target: { securityLevel: string } }) =>
      SecurityLevelGuard.canAccess(userRole, r.target.securityLevel as SecurityLevel),
    )
    const filteredTarget = asTarget.filter((r: { source: { securityLevel: string } }) =>
      SecurityLevelGuard.canAccess(userRole, r.source.securityLevel as SecurityLevel),
    )

    return { asSource: filteredSource, asTarget: filteredTarget }
  }

  /** 도메인 내 특정 문서의 관계 */
  async findByDocumentInDomain(documentId: string, domainCode: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, isDeleted: false },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const [asSource, asTarget] = await Promise.all([
      this.prisma.relation.findMany({
        where: { sourceId: documentId, domainCode },
        include: {
          target: { select: { id: true, fileName: true, lifecycle: true, securityLevel: true } },
        },
      }),
      this.prisma.relation.findMany({
        where: { targetId: documentId, domainCode },
        include: {
          source: { select: { id: true, fileName: true, lifecycle: true, securityLevel: true } },
        },
      }),
    ])

    const filteredSource = asSource.filter((r: { target: { securityLevel: string } }) =>
      SecurityLevelGuard.canAccess(userRole, r.target.securityLevel as SecurityLevel),
    )
    const filteredTarget = asTarget.filter((r: { source: { securityLevel: string } }) =>
      SecurityLevelGuard.canAccess(userRole, r.source.securityLevel as SecurityLevel),
    )

    return { asSource: filteredSource, asTarget: filteredTarget }
  }

  async create(
    sourceId: string,
    targetId: string,
    relationType: RelationType,
    domainCode: string | undefined,
    userId: string,
    userRole: UserRole,
  ) {
    if (sourceId === targetId) {
      throw new BadRequestException('자기 참조는 허용되지 않습니다')
    }

    const meta = RELATION_META[relationType]

    // domain_code 필수 체크
    if (meta.domainRequired && !domainCode) {
      throw new BadRequestException(`${relationType} 관계는 도메인 코드가 필수입니다`)
    }

    const effectiveDomainCode = meta.domainRequired ? domainCode! : (domainCode ?? null)

    // 두 문서 존재 확인
    const [source, target] = await Promise.all([
      this.prisma.document.findFirst({ where: { id: sourceId, isDeleted: false } }),
      this.prisma.document.findFirst({ where: { id: targetId, isDeleted: false } }),
    ])

    if (!source) throw new NotFoundException('출발 문서를 찾을 수 없습니다')
    if (!target) throw new NotFoundException('대상 문서를 찾을 수 없습니다')

    // 보안 등급 접근 확인
    if (!SecurityLevelGuard.canAccess(userRole, source.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('출발 문서에 대한 접근 권한이 없습니다')
    }
    if (!SecurityLevelGuard.canAccess(userRole, target.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('대상 문서에 대한 접근 권한이 없습니다')
    }

    // domain-scoped: 두 문서 모두 해당 도메인에 배치 확인
    if (effectiveDomainCode) {
      const [sourcePlacement, targetPlacement] = await Promise.all([
        this.prisma.documentPlacement.findUnique({
          where: { documentId_domainCode: { documentId: sourceId, domainCode: effectiveDomainCode } },
        }),
        this.prisma.documentPlacement.findUnique({
          where: { documentId_domainCode: { documentId: targetId, domainCode: effectiveDomainCode } },
        }),
      ])

      if (!sourcePlacement) {
        throw new BadRequestException('출발 문서가 해당 도메인에 배치되어 있지 않습니다')
      }
      if (!targetPlacement) {
        throw new BadRequestException('대상 문서가 해당 도메인에 배치되어 있지 않습니다')
      }
    }

    // 관계 생성 + 양방향 + 이력을 트랜잭션으로 처리
    const relation = await this.prisma.$transaction(async (tx) => {
      const rel = await tx.relation.create({
        data: {
          sourceId,
          targetId,
          relationType,
          domainCode: effectiveDomainCode,
          createdById: userId,
        },
      })

      // 양방향 관계면 역방향도 생성
      if (meta.bidirectional && meta.inverse) {
        try {
          await tx.relation.create({
            data: {
              sourceId: targetId,
              targetId: sourceId,
              relationType: meta.inverse,
              domainCode: effectiveDomainCode,
              createdById: userId,
            },
          })
        } catch (error: unknown) {
          // Unique 위반(이미 존재)만 무시, 나머지 DB 에러는 전파
          const isUnique = typeof error === 'object' && error !== null
            && 'code' in error && (error as { code: string }).code === 'P2002'
          if (!isUnique) throw error
        }
      }

      // 이력 기록
      await tx.documentHistory.create({
        data: {
          documentId: sourceId,
          action: 'RELATION_ADD',
          changes: { targetId, relationType, domainCode: effectiveDomainCode },
          userId,
        },
      })

      return rel
    })

    return relation
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const relation = await this.prisma.relation.findUnique({ where: { id } })
    if (!relation) throw new NotFoundException('관계를 찾을 수 없습니다')

    // 보안 등급 접근 확인
    const [source, target] = await Promise.all([
      this.prisma.document.findFirst({ where: { id: relation.sourceId, isDeleted: false }, select: { securityLevel: true } }),
      this.prisma.document.findFirst({ where: { id: relation.targetId, isDeleted: false }, select: { securityLevel: true } }),
    ])
    if (source && !SecurityLevelGuard.canAccess(userRole, source.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('출발 문서에 대한 접근 권한이 없습니다')
    }
    if (target && !SecurityLevelGuard.canAccess(userRole, target.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('대상 문서에 대한 접근 권한이 없습니다')
    }

    const meta = RELATION_META[relation.relationType as RelationType]

    await this.prisma.$transaction(async (tx) => {
      // 양방향이면 역방향도 삭제
      if (meta?.bidirectional && meta.inverse) {
        await tx.relation.deleteMany({
          where: {
            sourceId: relation.targetId,
            targetId: relation.sourceId,
            relationType: meta.inverse,
            domainCode: relation.domainCode,
          },
        })
      }

      await tx.relation.delete({ where: { id } })

      await tx.documentHistory.create({
        data: {
          documentId: relation.sourceId,
          action: 'RELATION_REMOVE',
          changes: { targetId: relation.targetId, relationType: relation.relationType, domainCode: relation.domainCode },
          userId,
        },
      })
    })

    return { message: '관계가 삭제되었습니다' }
  }

  /** BFS로 다중 홉 관계 그래프 반환 (도메인 스코프) */
  async getRelationGraph(documentId: string, userRole: UserRole, depth: number = 1, domainCode?: string) {
    const maxDepth = Math.min(depth, 3)

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, isDeleted: false },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    // BFS 초기화
    const visited = new Set<string>([documentId])
    const queue: Array<{ id: string; currentDepth: number }> = [{ id: documentId, currentDepth: 0 }]
    const nodeMap = new Map<string, GraphNode>()
    const edgeList: GraphEdge[] = []
    const edgeSet = new Set<string>()

    // 시작 노드 등록
    nodeMap.set(documentId, {
      id: doc.id,
      docCode: doc.docCode,
      fileName: doc.fileName,
      lifecycle: doc.lifecycle as GraphNode['lifecycle'],
      securityLevel: doc.securityLevel as GraphNode['securityLevel'],
      depth: 0,
    })

    // BFS 순회
    while (queue.length > 0) {
      const { id: currentId, currentDepth } = queue.shift()!

      if (currentDepth >= maxDepth) continue

      const domainFilter = domainCode ? { domainCode } : {}
      const [asSource, asTarget] = await Promise.all([
        this.prisma.relation.findMany({
          where: { sourceId: currentId, ...domainFilter },
          select: { id: true, sourceId: true, targetId: true, relationType: true, domainCode: true },
        }),
        this.prisma.relation.findMany({
          where: { targetId: currentId, ...domainFilter },
          select: { id: true, sourceId: true, targetId: true, relationType: true, domainCode: true },
        }),
      ])

      const neighborIds = new Set<string>()
      const relations = [...asSource, ...asTarget]

      for (const rel of relations) {
        const edgeKey = `${rel.sourceId}-${rel.targetId}-${rel.relationType}-${rel.domainCode ?? 'null'}`
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edgeList.push({
            id: rel.id,
            sourceId: rel.sourceId,
            targetId: rel.targetId,
            relationType: rel.relationType as GraphEdge['relationType'],
            domainCode: rel.domainCode,
          })
        }

        const neighborId = rel.sourceId === currentId ? rel.targetId : rel.sourceId
        if (!visited.has(neighborId)) {
          visited.add(neighborId)
          neighborIds.add(neighborId)
        }
      }

      // 이웃 문서 일괄 조회
      if (neighborIds.size > 0) {
        const neighbors = await this.prisma.document.findMany({
          where: { id: { in: [...neighborIds] }, isDeleted: false },
        })

        for (const neighbor of neighbors) {
          if (!SecurityLevelGuard.canAccess(userRole, neighbor.securityLevel as SecurityLevel)) {
            continue
          }

          nodeMap.set(neighbor.id, {
            id: neighbor.id,
            docCode: neighbor.docCode,
            fileName: neighbor.fileName,
            lifecycle: neighbor.lifecycle as GraphNode['lifecycle'],
            securityLevel: neighbor.securityLevel as GraphNode['securityLevel'],
            depth: currentDepth + 1,
          })

          queue.push({ id: neighbor.id, currentDepth: currentDepth + 1 })
        }
      }
    }

    // 접근 불가 노드가 포함된 엣지 제거
    const validEdges = edgeList.filter(
      (e) => nodeMap.has(e.sourceId) && nodeMap.has(e.targetId),
    )

    return {
      nodes: [...nodeMap.values()],
      edges: validEdges,
      centerId: documentId,
    }
  }

  /** 도메인 내 관계 그래프 — 배치된 모든 문서를 노드로 포함 (관계 없는 고아 노드 포함) */
  async getRelationGraphByDomain(domainCode: string, userRole: UserRole, maxNodes: number = 200) {
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    // 1. 해당 도메인에 배치된 모든 문서 조회 (관계 유무 무관)
    const placements = await this.prisma.documentPlacement.findMany({
      where: { domainCode },
      select: { documentId: true },
    })
    const placedDocIds = placements.map((p) => p.documentId)

    // 2. 문서 일괄 조회 (보안등급 필터)
    const docs = await this.prisma.document.findMany({
      where: {
        id: { in: placedDocIds },
        isDeleted: false,
        securityLevel: { in: allowedLevels },
      },
      take: maxNodes,
    })

    if (docs.length === 0) {
      return { nodes: [], edges: [], centerId: '' }
    }

    const nodeMap = new Map<string, GraphNode>()
    for (const doc of docs) {
      nodeMap.set(doc.id, {
        id: doc.id,
        docCode: doc.docCode,
        fileName: doc.fileName,
        lifecycle: doc.lifecycle as GraphNode['lifecycle'],
        securityLevel: doc.securityLevel as GraphNode['securityLevel'],
        depth: 0,
      })
    }

    // 3. 해당 도메인의 관계 조회
    const relations = await this.prisma.relation.findMany({
      where: {
        domainCode,
        source: { isDeleted: false, securityLevel: { in: allowedLevels } },
        target: { isDeleted: false, securityLevel: { in: allowedLevels } },
      },
      select: { id: true, sourceId: true, targetId: true, relationType: true, domainCode: true },
    })

    const edges: GraphEdge[] = relations
      .filter((r) => nodeMap.has(r.sourceId) && nodeMap.has(r.targetId))
      .map((r) => ({
        id: r.id,
        sourceId: r.sourceId,
        targetId: r.targetId,
        relationType: r.relationType as GraphEdge['relationType'],
        domainCode: r.domainCode,
      }))

    return {
      nodes: [...nodeMap.values()],
      edges,
      centerId: '',
    }
  }

  /**
   * 전역 관계 그래프: 모든 문서를 노드로 포함 (관계 없는 고아 문서 포함)
   * 도메인 필터 시 해당 도메인에 배치된 문서만 표시
   */
  async getGlobalGraph(userRole: UserRole, maxNodes: number = 200, domainCode?: string): Promise<GlobalGraphResponse> {
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    // 1. 문서 조회: 도메인 필터 있으면 해당 배치 문서, 없으면 전체
    const docWhere: Record<string, unknown> = {
      isDeleted: false,
      securityLevel: { in: allowedLevels },
    }
    if (domainCode) {
      docWhere.placements = { some: { domainCode } }
    }

    const totalCount = await this.prisma.document.count({ where: docWhere })
    const hasMore = totalCount > maxNodes

    const docs = await this.prisma.document.findMany({
      where: docWhere,
      take: maxNodes,
      orderBy: { createdAt: 'desc' },
    })

    const nodeMap = new Map<string, GraphNode>()
    for (const doc of docs) {
      nodeMap.set(doc.id, {
        id: doc.id,
        docCode: doc.docCode,
        fileName: doc.fileName,
        lifecycle: doc.lifecycle as GraphNode['lifecycle'],
        securityLevel: doc.securityLevel as GraphNode['securityLevel'],
        depth: 0,
      })
    }

    // 2. 관계 조회 (노드에 포함된 문서 간의 관계만)
    const docIds = [...nodeMap.keys()]
    const relations = await this.prisma.relation.findMany({
      where: {
        ...(domainCode ? { domainCode } : {}),
        sourceId: { in: docIds },
        targetId: { in: docIds },
      },
      select: { id: true, sourceId: true, targetId: true, relationType: true, domainCode: true },
    })

    const edges: GraphEdge[] = relations
      .filter((r) => nodeMap.has(r.sourceId) && nodeMap.has(r.targetId))
      .map((r) => ({
        id: r.id,
        sourceId: r.sourceId,
        targetId: r.targetId,
        relationType: r.relationType as GraphEdge['relationType'],
        domainCode: r.domainCode,
      }))

    return {
      nodes: [...nodeMap.values()],
      edges,
      hasMore,
    }
  }
}
