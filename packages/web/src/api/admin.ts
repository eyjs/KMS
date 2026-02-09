import { client } from './client'
import type { UserEntity, UserRole } from '@kms/shared'

export interface CreateUserPayload {
  email: string
  password: string
  name: string
  role: UserRole
}

export interface UpdateUserPayload {
  name?: string
  role?: UserRole
  isActive?: boolean
}

export const adminApi = {
  listUsers() {
    return client.get<UserEntity[]>('/admin/users')
  },

  updateUser(id: string, data: UpdateUserPayload) {
    return client.put<UserEntity>(`/admin/users/${id}`, data)
  },
}
