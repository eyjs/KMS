import { client } from './client'
import type { DocumentEntity, DocumentListQuery, PaginatedResponse } from '@kms/shared'

export interface DocumentStats {
  total: number
  active: number
  draft: number
  deprecated: number
  orphan: number
  byDomain: Array<{
    domain: string
    displayName: string
    total: number
  }>
}

export interface RecentActivity {
  id: string
  documentId: string
  fileName: string
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

  upload(file: File, data?: { securityLevel?: string; validUntil?: string }) {
    const formData = new FormData()
    formData.append('file', file)
    if (data?.securityLevel) formData.append('securityLevel', data.securityLevel)
    if (data?.validUntil) formData.append('validUntil', data.validUntil)
    return client.post<DocumentEntity>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  bulkUpload(files: File[], securityLevel?: string) {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }
    if (securityLevel) formData.append('securityLevel', securityLevel)
    return client.post<{
      succeeded: number
      failed: number
      results: Array<{
        fileName: string
        success: boolean
        documentId?: string
        docCode?: string | null
        error?: string
        existingDocumentId?: string
      }>
    }>('/documents/bulk-upload', formData, {
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

  update(id: string, data: { securityLevel?: string; validUntil?: string | null; fileName?: string; rowVersion: number }) {
    return client.put<DocumentEntity>(`/documents/${id}`, data)
  },

  transitionLifecycle(id: string, lifecycle: string) {
    return client.patch<DocumentEntity>(`/documents/${id}/lifecycle`, { lifecycle })
  },

  bulkTransitionLifecycle(ids: string[], lifecycle: string) {
    return client.patch<{ succeeded: number; failed: number; results: Array<{ id: string; success: boolean; error?: string }> }>(
      '/documents/bulk/lifecycle',
      { ids, lifecycle },
    )
  },

  delete(id: string) {
    return client.delete(`/documents/${id}`)
  },

  downloadFile(id: string) {
    return client.get(`/documents/${id}/file`, { responseType: 'blob' })
  },

  previewFile(id: string) {
    return client.get(`/documents/${id}/preview`, { responseType: 'blob' })
  },

  getStats() {
    return client.get<DocumentStats>('/documents/stats')
  },

  getRecent(limit = 10) {
    return client.get<RecentActivity[]>('/documents/recent', { params: { limit } })
  },

  getHistory(id: string) {
    return client.get<DocumentHistoryEntry[]>(`/documents/${id}/history`)
  },

  getPreviewUrl(id: string): string {
    const baseURL = client.defaults.baseURL || '/api'
    return `${baseURL}/documents/${id}/preview`
  },

  getOrphans(page = 1, size = 20) {
    return client.get<PaginatedResponse<DocumentEntity>>('/documents/orphans', { params: { page, size } })
  },

  getMyDocuments(page = 1, size = 20, orphan?: boolean | null) {
    const params: Record<string, unknown> = { page, size }
    if (orphan === true) params.orphan = 'true'
    else if (orphan === false) params.orphan = 'false'
    return client.get<PaginatedResponse<DocumentEntity>>('/documents/my', { params })
  },

  search(params: { q?: string; domain?: string; lifecycle?: string; orphan?: boolean; page?: number; size?: number }) {
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
