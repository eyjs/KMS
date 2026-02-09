import { client } from './client'
import type {
  DomainMasterEntity,
  FacetMasterEntity,
  CreateDomainDto,
  UpdateDomainDto,
} from '@kms/shared'

export const taxonomyApi = {
  getDomains() {
    return client.get<DomainMasterEntity[]>('/domains')
  },

  getDomainsFlat() {
    return client.get<DomainMasterEntity[]>('/domains/flat')
  },

  getFacets(facetType: string, domain?: string) {
    return client.get<FacetMasterEntity[]>(`/taxonomy/${facetType}`, {
      params: domain ? { domain } : undefined,
    })
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
