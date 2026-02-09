import { client } from './client'
import type { RelationEntity, RelationType } from '@kms/shared'

export const relationsApi = {
  getByDocument(documentId: string) {
    return client.get<{ asSource: RelationEntity[]; asTarget: RelationEntity[] }>(
      `/documents/${documentId}/relations`,
    )
  },

  create(sourceId: string, targetId: string, relationType: RelationType) {
    return client.post<RelationEntity>('/relations', { sourceId, targetId, relationType })
  },

  delete(id: string) {
    return client.delete(`/relations/${id}`)
  },
}
