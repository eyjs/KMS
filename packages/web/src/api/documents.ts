import { client } from './client'
import type { DocumentEntity, DocumentListQuery, PaginatedResponse } from '@kms/shared'

export const documentsApi = {
  list(query: DocumentListQuery) {
    return client.get<PaginatedResponse<DocumentEntity>>('/documents', { params: query })
  },

  get(id: string) {
    return client.get<DocumentEntity>(`/documents/${id}`)
  },

  upload(file: File, data: { domain: string; classifications: Record<string, string>; securityLevel?: string }) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('domain', data.domain)
    formData.append('classifications', JSON.stringify(data.classifications))
    if (data.securityLevel) formData.append('securityLevel', data.securityLevel)
    return client.post<DocumentEntity>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  update(id: string, data: { classifications?: Record<string, string>; securityLevel?: string; rowVersion: number }) {
    return client.put<DocumentEntity>(`/documents/${id}`, data)
  },

  transitionLifecycle(id: string, lifecycle: string) {
    return client.patch<DocumentEntity>(`/documents/${id}/lifecycle`, { lifecycle })
  },

  delete(id: string) {
    return client.delete(`/documents/${id}`)
  },

  downloadFile(id: string) {
    return client.get(`/documents/${id}/file`, { responseType: 'blob' })
  },
}
