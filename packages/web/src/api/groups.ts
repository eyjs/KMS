import { client } from './client'
import type {
  PermissionGroupEntity,
  UserGroupMembershipEntity,
  GroupFolderAccessEntity,
  CreateGroupDto,
  UpdateGroupDto,
  SetFolderAccessDto,
  ApiKeyEntity,
  UserRole,
} from '@kms/shared'

export const groupsApi = {
  // ============================================================
  // 권한 그룹 CRUD
  // ============================================================

  list() {
    return client.get<PermissionGroupEntity[]>('/groups')
  },

  getById(id: string) {
    return client.get<PermissionGroupEntity>(`/groups/${id}`)
  },

  create(data: CreateGroupDto) {
    return client.post<PermissionGroupEntity>('/groups', data)
  },

  update(id: string, data: UpdateGroupDto) {
    return client.patch<PermissionGroupEntity>(`/groups/${id}`, data)
  },

  remove(id: string) {
    return client.delete(`/groups/${id}`)
  },

  // ============================================================
  // 그룹 멤버 관리
  // ============================================================

  getMembers(groupId: string) {
    return client.get<UserGroupMembershipEntity[]>(`/groups/${groupId}/members`)
  },

  addMember(groupId: string, userId: string) {
    return client.post<UserGroupMembershipEntity>(`/groups/${groupId}/members`, { userId })
  },

  removeMember(groupId: string, userId: string) {
    return client.delete(`/groups/${groupId}/members/${userId}`)
  },

  // ============================================================
  // 그룹-폴더 권한 관리
  // ============================================================

  getFolderAccess(groupId: string) {
    return client.get<GroupFolderAccessEntity[]>(`/groups/${groupId}/folders`)
  },

  setFolderAccess(groupId: string, data: SetFolderAccessDto) {
    return client.post<GroupFolderAccessEntity>(`/groups/${groupId}/folders`, data)
  },

  removeFolderAccess(groupId: string, categoryId: number) {
    return client.delete(`/groups/${groupId}/folders/${categoryId}`)
  },

  // ============================================================
  // 사용자 그룹 관리
  // ============================================================

  getUserGroups(userId: string) {
    return client.get<PermissionGroupEntity[]>(`/auth/users/${userId}/groups`)
  },

  updateUserGroups(userId: string, groupIds: string[]) {
    return client.put<PermissionGroupEntity[]>(`/auth/users/${userId}/groups`, { groupIds })
  },

  // ============================================================
  // API Key 관리
  // ============================================================

  listApiKeys() {
    return client.get<ApiKeyEntity[]>('/auth/api-keys')
  },

  createApiKey(data: { name: string; role: UserRole; expiresAt?: string; groupIds?: string[] }) {
    return client.post<{ key: string; keyPrefix: string; name: string; role: string; groupIds?: string[] }>('/auth/api-keys', data)
  },

  toggleApiKeyActive(apiKeyId: string) {
    return client.patch<{ id: number; isActive: boolean }>(`/auth/api-keys/${apiKeyId}/toggle-active`)
  },

  deleteApiKey(apiKeyId: string) {
    return client.delete(`/auth/api-keys/${apiKeyId}`)
  },

  getApiKeyGroups(apiKeyId: string) {
    return client.get<PermissionGroupEntity[]>(`/auth/api-keys/${apiKeyId}/groups`)
  },

  updateApiKeyGroups(apiKeyId: string, groupIds: string[]) {
    return client.put<PermissionGroupEntity[]>(`/auth/api-keys/${apiKeyId}/groups`, { groupIds })
  },
}
