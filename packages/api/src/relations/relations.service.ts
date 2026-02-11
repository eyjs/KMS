import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TaxonomyService } from '../taxonomy/taxonomy.service'
import { SecurityLevelGuard } from '../auth/guards/security-level.guard'
import { RELATION_META, SECURITY_LEVEL_ORDER } from '@kms/shared'
import type { RelationType, UserRole, SecurityLevel, GraphNode, GraphEdge } from '@kms/shared'

@Injectable()
export class RelationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
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
          target: { select: { id: true, fileName: true, domain: true, lifecycle: true, securityLevel: true } },
        },
      }),
      this.prisma.relation.findMany({
        where: { targetId: documentId },
        include: {
          source: { select: { id: true, fileName: true, domain: true, lifecycle: true, securityLevel: true } },
        },
      }),
    ])

    // 사용자 역할로 접근 가능한 관계 문서만 필터
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
    userId: string,
    userRole: UserRole,
  ) {
    if (sourceId === targetId) {
      throw new BadRequestException('자기 참조는 허용되지 않습니다')
    }

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

    // scope 검증
    const meta = RELATION_META[relationType]
    if (meta?.scope === 'same_domain' && source.domain !== target.domain) {
      throw new BadRequestException(
        `${relationType} 관계는 같은 도메인 내에서만 가능합니다`,
      )
    }

    // 관계 생성 (순환 참조는 DB 트리거에서 체크)
    const relation = await this.prisma.relation.create({
      data: {
        sourceId,
        targetId,
        relationType,
        createdById: userId,
      },
    })

    // 양방향 관계면 역방향도 생성
    if (meta?.bidirectional && meta.inverse) {
      await this.prisma.relation.upsert({
        where: {
          sourceId_targetId_relationType: {
            sourceId: targetId,
            targetId: sourceId,
            relationType: meta.inverse,
          },
        },
        update: {},
        create: {
          sourceId: targetId,
          targetId: sourceId,
          relationType: meta.inverse,
          createdById: userId,
        },
      })
    }

    // 이력 기록
    await this.prisma.documentHistory.create({
      data: {
        documentId: sourceId,
        action: 'RELATION_ADD',
        changes: { targetId, relationType },
        userId,
      },
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

    // 양방향이면 역방향도 삭제
    const meta = RELATION_META[relation.relationType as RelationType]
    if (meta?.bidirectional && meta.inverse) {
      await this.prisma.relation.deleteMany({
        where: {
          sourceId: relation.targetId,
          targetId: relation.sourceId,
          relationType: meta.inverse,
        },
      })
    }

    await this.prisma.relation.delete({ where: { id } })

    await this.prisma.documentHistory.create({
      data: {
        documentId: relation.sourceId,
        action: 'RELATION_REMOVE',
        changes: { targetId: relation.targetId, relationType: relation.relationType },
        userId,
      },
    })

    return { message: '관계가 삭제되었습니다' }
  }

  /** BFS로 다중 홉 관계 그래프 반환 (vis-network용) */
  async getRelationGraph(documentId: string, userRole: UserRole, depth: number = 1) {
    const maxDepth = Math.min(depth, 3)

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, isDeleted: false },
      include: { classifications: true },
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
    const classifications: Record<string, string> = {}
    for (const c of doc.classifications) {
      classifications[c.facetType] = c.facetValue
    }
    nodeMap.set(documentId, {
      id: doc.id,
      docCode: doc.docCode,
      fileName: doc.fileName,
      domain: doc.domain,
      lifecycle: doc.lifecycle as GraphNode['lifecycle'],
      securityLevel: doc.securityLevel as GraphNode['securityLevel'],
      classifications,
      depth: 0,
    })

    // BFS 순회
    while (queue.length > 0) {
      const { id: currentId, currentDepth } = queue.shift()!

      if (currentDepth >= maxDepth) continue

      const [asSource, asTarget] = await Promise.all([
        this.prisma.relation.findMany({
          where: { sourceId: currentId },
          select: { id: true, sourceId: true, targetId: true, relationType: true },
        }),
        this.prisma.relation.findMany({
          where: { targetId: currentId },
          select: { id: true, sourceId: true, targetId: true, relationType: true },
        }),
      ])

      const neighborIds = new Set<string>()
      const relations = [...asSource, ...asTarget]

      for (const rel of relations) {
        const edgeKey = `${rel.sourceId}-${rel.targetId}-${rel.relationType}`
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edgeList.push({
            id: rel.id,
            sourceId: rel.sourceId,
            targetId: rel.targetId,
            relationType: rel.relationType as GraphEdge['relationType'],
          })
        }

        const neighborId = rel.sourceId === currentId ? rel.targetId : rel.sourceId
        if (!visited.has(neighborId)) {
          visited.add(neighborId)
          neighborIds.add(neighborId)
        }
      }

      // 이웃 문서 일괄 조회 (N+1 방지)
      if (neighborIds.size > 0) {
        const neighbors = await this.prisma.document.findMany({
          where: { id: { in: [...neighborIds] }, isDeleted: false },
          include: { classifications: true },
        })

        for (const neighbor of neighbors) {
          // 보안 필터링: 접근 불가 문서는 그래프에서 제외
          if (!SecurityLevelGuard.canAccess(userRole, neighbor.securityLevel as SecurityLevel)) {
            continue
          }

          const neighborClassifications: Record<string, string> = {}
          for (const c of neighbor.classifications) {
            neighborClassifications[c.facetType] = c.facetValue
          }

          nodeMap.set(neighbor.id, {
            id: neighbor.id,
            docCode: neighbor.docCode,
            fileName: neighbor.fileName,
            domain: neighbor.domain,
            lifecycle: neighbor.lifecycle as GraphNode['lifecycle'],
            securityLevel: neighbor.securityLevel as GraphNode['securityLevel'],
            classifications: neighborClassifications,
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

  /** 도메인 내 관계가 있는 문서들의 그래프 반환 */
  async getRelationGraphByDomain(domainCode: string, userRole: UserRole, maxNodes: number = 200) {
    const maxLevel = SecurityLevelGuard.maxAccessLevel(userRole)
    const allowedLevels = Object.entries(SECURITY_LEVEL_ORDER)
      .filter(([, level]) => level <= maxLevel)
      .map(([name]) => name)

    // 도메인 + 하위 도메인 코드 수집
    const domainCodes = await this.taxonomy.getDescendantCodes(domainCode)

    // 관계가 있는 문서만 조회 (성능: 관계 테이블 기준)
    const relations = await this.prisma.relation.findMany({
      where: {
        OR: [
          { source: { domain: { in: domainCodes }, isDeleted: false, securityLevel: { in: allowedLevels } } },
          { target: { domain: { in: domainCodes }, isDeleted: false, securityLevel: { in: allowedLevels } } },
        ],
      },
      select: { id: true, sourceId: true, targetId: true, relationType: true },
    })

    // 관련 문서 ID 수집
    const docIds = new Set<string>()
    for (const r of relations) {
      docIds.add(r.sourceId)
      docIds.add(r.targetId)
    }

    // 노드 수 상한 초과 시 조기 반환
    if (docIds.size > maxNodes) {
      return { nodes: [], edges: [], centerId: '' }
    }

    // 문서 일괄 조회
    const docs = await this.prisma.document.findMany({
      where: {
        id: { in: [...docIds] },
        isDeleted: false,
        securityLevel: { in: allowedLevels },
      },
      include: { classifications: true },
    })

    const nodeMap = new Map<string, GraphNode>()
    for (const doc of docs) {
      const classifications: Record<string, string> = {}
      for (const c of doc.classifications) {
        classifications[c.facetType] = c.facetValue
      }
      nodeMap.set(doc.id, {
        id: doc.id,
        docCode: doc.docCode,
        fileName: doc.fileName,
        domain: doc.domain,
        lifecycle: doc.lifecycle as GraphNode['lifecycle'],
        securityLevel: doc.securityLevel as GraphNode['securityLevel'],
        classifications,
        depth: 0,
      })
    }

    // 양쪽 노드가 모두 있는 엣지만 반환
    const edges: GraphEdge[] = relations
      .filter((r) => nodeMap.has(r.sourceId) && nodeMap.has(r.targetId))
      .map((r) => ({
        id: r.id,
        sourceId: r.sourceId,
        targetId: r.targetId,
        relationType: r.relationType as GraphEdge['relationType'],
      }))

    return {
      nodes: [...nodeMap.values()],
      edges,
      centerId: '',
    }
  }
}
