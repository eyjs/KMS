import { client } from './client'
import type { RelationEntity, RelationType, RelationGraphResponse } from '@kms/shared'

export const relationsApi = {
  getByDocument(documentId: string) {
    return client.get<{ asSource: RelationEntity[]; asTarget: RelationEntity[] }>(
      `/documents/${documentId}/relations`,
    )
  },

  getGraph(documentId: string, depth: number = 1) {
    return client.get<RelationGraphResponse>(
      `/documents/${documentId}/relations/graph`,
      { params: { depth } },
    )
  },

  create(sourceId: string, targetId: string, relationType: RelationType) {
    return client.post<RelationEntity>('/relations', { sourceId, targetId, relationType })
  },

  delete(id: string) {
    return client.delete(`/relations/${id}`)
  },
}
