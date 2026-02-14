import { client } from './client'
import type {
  RelationType,
  OntologyGraphResponse,
  RelationTypeEntity,
  RelationPropertyEntity,
  KnowledgeGraphResponse,
} from '@kms/shared'

export const knowledgeGraphApi = {
  /** 기본 지식그래프 탐색 */
  explore(startId: string, depth: number = 1, relationTypes?: RelationType[], maxNodes?: number) {
    return client.get<KnowledgeGraphResponse>('/knowledge-graph/explore', {
      params: { startId, depth, relationTypes, maxNodes },
    })
  },

  /** 온톨로지 지식그래프 탐색 (메타데이터 + 속성 포함) */
  exploreOntology(startId: string, depth: number = 1, relationTypes?: RelationType[], maxNodes?: number) {
    return client.get<OntologyGraphResponse>('/knowledge-graph/explore-ontology', {
      params: { startId, depth, relationTypes, maxNodes },
    })
  },

  /** 두 문서 간 최단 경로 */
  findPath(fromId: string, toId: string) {
    return client.get<{
      found: boolean
      path: string[]
      relations: Array<{ id: string; sourceId: string; targetId: string; relationType: RelationType }>
    }>('/knowledge-graph/path', {
      params: { fromId, toId },
    })
  },

  /** 관계 유형 목록 */
  getRelationTypes() {
    return client.get<RelationTypeEntity[]>('/knowledge-graph/relation-types')
  },

  /** 관계 속성 조회 */
  getRelationProperties(relationId: string) {
    return client.get<RelationPropertyEntity[]>(`/knowledge-graph/relations/${relationId}/properties`)
  },

  /** 관계 속성 설정 */
  setRelationProperty(relationId: string, key: string, value: string) {
    return client.post<RelationPropertyEntity>(`/knowledge-graph/relations/${relationId}/properties`, {
      key,
      value,
    })
  },

  /** 관계 속성 삭제 */
  deleteRelationProperty(relationId: string, key: string) {
    return client.delete(`/knowledge-graph/relations/${relationId}/properties/${key}`)
  },
}
