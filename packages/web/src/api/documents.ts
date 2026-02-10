import { client } from './client'
import type { DocumentEntity, DocumentListQuery, PaginatedResponse } from '@kms/shared'

export interface DocumentStats {
  total: number
  active: number
  draft: number
  deprecated: number
  freshnessWarning: number
  byDomain: Array<{
    domain: string
    displayName: string
    total: number
    active: number
    draft: number
    deprecated: number
    warning: number
  }>
}

export interface RecentActivity {
  id: string
  documentId: string
  fileName: string
  domain: string
  action: string
  changes: Record<string, unknown> | null
  userName: string | null
  createdAt: string
}

export interface DocumentHistoryEntry {
  id: string
  action: string
  changes: Record<string, unknown> | null
  userName: string | null
  createdAt: string
}

export interface DocumentCounts {
  [key: string]: number
}

export interface IssueCounts {
  warning: number
  expired: number
  noFile: number
  staleDraft: number
}

export const documentsApi = {
  list(query: DocumentListQuery) {
    return client.get<PaginatedResponse<DocumentEntity>>('/documents', { params: query })
  },

  get(id: string) {
    return client.get<DocumentEntity>(`/documents/${id}`)
  },

  upload(file: File, data: { domain: string; classifications: Record<string, string>; securityLevel?: string; validUntil?: string }) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('domain', data.domain)
    formData.append('classifications', JSON.stringify(data.classifications))
    if (data.securityLevel) formData.append('securityLevel', data.securityLevel)
    if (data.validUntil) formData.append('validUntil', data.validUntil)
    return client.post<DocumentEntity>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  createMetadata(data: { domain: string; classifications: Record<string, string>; securityLevel?: string; title: string; validUntil?: string }) {
    const formData = new FormData()
    formData.append('domain', data.domain)
    formData.append('classifications', JSON.stringify(data.classifications))
    formData.append('title', data.title)
    if (data.securityLevel) formData.append('securityLevel', data.securityLevel)
    if (data.validUntil) formData.append('validUntil', data.validUntil)
    return client.post<DocumentEntity>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  attachFile(id: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return client.patch<DocumentEntity>(`/documents/${id}/file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  update(id: string, data: { classifications?: Record<string, string>; securityLevel?: string; validUntil?: string | null; rowVersion: number }) {
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

  getStats() {
    return client.get<DocumentStats>('/documents/stats')
  },

  getRecent(limit = 10) {
    return client.get<RecentActivity[]>('/documents/recent', { params: { limit } })
  },

  getCounts(params: { domain: string; groupBy: string }) {
    return client.get<DocumentCounts>('/documents/counts', { params })
  },

  getHistory(id: string) {
    return client.get<DocumentHistoryEntry[]>(`/documents/${id}/history`)
  },

  getPreviewUrl(id: string): string {
    const baseURL = client.defaults.baseURL || '/api'
    return `${baseURL}/documents/${id}/preview`
  },

  search(params: { q?: string; domain?: string; lifecycle?: string; page?: number; size?: number }) {
    return client.get<PaginatedResponse<DocumentEntity>>('/documents/search', { params })
  },

  getIssues(type: string, page = 1, size = 10) {
    return client.get<PaginatedResponse<DocumentEntity>>('/documents/issues', {
      params: { type, page, size },
    })
  },

  getIssueCounts() {
    return client.get<IssueCounts>('/documents/issues/counts')
  },
}
