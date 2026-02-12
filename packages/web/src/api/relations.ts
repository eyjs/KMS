import { client } from './client'
import type { RelationEntity, RelationType, RelationGraphResponse, GlobalGraphResponse } from '@kms/shared'

export const relationsApi = {
  getByDocument(documentId: string) {
    return client.get<{ asSource: RelationEntity[]; asTarget: RelationEntity[] }>(
      `/documents/${documentId}/relations`,
    )
  },

  getByDocumentInDomain(domainCode: string, documentId: string) {
    return client.get<{ asSource: RelationEntity[]; asTarget: RelationEntity[] }>(
      `/domains/${domainCode}/documents/${documentId}/relations`,
    )
  },

  getGraph(documentId: string, depth: number = 1, domain?: string) {
    return client.get<RelationGraphResponse>(
      `/documents/${documentId}/relations/graph`,
      { params: { depth, domain } },
    )
  },

  getDomainGraph(domainCode: string, maxNodes: number = 200) {
    return client.get<RelationGraphResponse>(
      `/relations/graph/domain/${domainCode}`,
      { params: { maxNodes } },
    )
  },

  getGlobalGraph(domain?: string, maxNodes: number = 200) {
    return client.get<GlobalGraphResponse>(
      '/relations/graph/global',
      { params: { domain, maxNodes } },
    )
  },

  create(sourceId: string, targetId: string, relationType: RelationType, domainCode?: string) {
    return client.post<RelationEntity>('/relations', { sourceId, targetId, relationType, domainCode })
  },

  delete(id: string) {
    return client.delete(`/relations/${id}`)
  },
}
