import { client } from './client'
import type {
  DomainCategoryEntity,
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateCategoryPermissionsDto,
} from '@kms/shared'

export const categoriesApi = {
  getByDomain(domainCode: string) {
    return client.get<DomainCategoryEntity[]>(`/domains/${domainCode}/categories`)
  },

  create(domainCode: string, data: Omit<CreateCategoryDto, 'domainCode'>) {
    return client.post<DomainCategoryEntity>(`/domains/${domainCode}/categories`, data)
  },

  update(id: number, data: UpdateCategoryDto) {
    return client.patch<DomainCategoryEntity>(`/categories/${id}`, data)
  },

  remove(id: number) {
    return client.delete(`/categories/${id}`)
  },

  move(id: number, parentId: number | null) {
    return client.patch(`/categories/${id}/move`, { parentId })
  },

  updatePermissions(id: number, data: UpdateCategoryPermissionsDto) {
    return client.patch<DomainCategoryEntity>(`/categories/${id}/permissions`, data)
  },
}
