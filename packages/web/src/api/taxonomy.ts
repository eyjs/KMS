import { client } from './client'
import type {
  DomainMasterEntity,
  CreateDomainDto,
  UpdateDomainDto,
} from '@kms/shared'

export const taxonomyApi = {
  // Domains
  getDomains() {
    return client.get<DomainMasterEntity[]>('/domains')
  },

  getDomainsFlat() {
    return client.get<DomainMasterEntity[]>('/domains/flat')
  },

  createDomain(data: CreateDomainDto) {
    return client.post<DomainMasterEntity>('/domains', data)
  },

  updateDomain(code: string, data: UpdateDomainDto) {
    return client.put<DomainMasterEntity>(`/domains/${code}`, data)
  },

  deleteDomain(code: string) {
    return client.delete(`/domains/${code}`)
  },
}
