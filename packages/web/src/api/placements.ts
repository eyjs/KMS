import { client } from './client'
import type {
  DocumentPlacementEntity,
  DocumentEntity,
  PaginatedResponse,
  CreatePlacementDto,
  UpdatePlacementDto,
  BulkPlacementDto,
  BulkPlacementResult,
} from '@kms/shared'

export const placementsApi = {
  getByDocument(documentId: string) {
    return client.get<DocumentPlacementEntity[]>(`/documents/${documentId}/placements`)
  },

  getByDomain(domainCode: string, params?: Record<string, unknown>) {
    return client.get<PaginatedResponse<DocumentEntity>>(`/domains/${domainCode}/documents`, { params })
  },

  create(data: CreatePlacementDto) {
    return client.post<DocumentPlacementEntity>('/placements', data)
  },

  bulkCreate(data: BulkPlacementDto) {
    return client.post<BulkPlacementResult>('/placements/bulk', data)
  },

  update(id: string, data: UpdatePlacementDto) {
    return client.patch<DocumentPlacementEntity>(`/placements/${id}`, data)
  },

  remove(id: string) {
    return client.delete(`/placements/${id}`)
  },
}
