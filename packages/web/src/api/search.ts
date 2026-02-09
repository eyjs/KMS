import { client } from './client'
import type { DocumentEntity, PaginatedResponse } from '@kms/shared'

export interface SearchQuery {
  q?: string
  domain?: string
  lifecycle?: string
  securityLevel?: string
  page?: number
  size?: number
}

export const searchApi = {
  search(query: SearchQuery) {
    return client.get<PaginatedResponse<DocumentEntity>>('/documents/search', { params: query })
  },
}
