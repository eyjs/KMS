import { client } from './client'
import type {
  DomainMasterEntity,
  FacetMasterEntity,
  FacetTypeMasterEntity,
  CreateDomainDto,
  UpdateDomainDto,
  CreateFacetDto,
  UpdateFacetDto,
  CreateFacetTypeDto,
  UpdateFacetTypeDto,
} from '@kms/shared'

export const taxonomyApi = {
  // Facet Types
  getFacetTypes(domain?: string) {
    return client.get<FacetTypeMasterEntity[]>('/facet-types', {
      params: domain ? { domain } : undefined,
    })
  },

  createFacetType(data: CreateFacetTypeDto) {
    return client.post<FacetTypeMasterEntity>('/facet-types', data)
  },

  updateFacetType(code: string, data: UpdateFacetTypeDto) {
    return client.put<FacetTypeMasterEntity>(`/facet-types/${code}`, data)
  },

  deleteFacetType(code: string) {
    return client.delete(`/facet-types/${code}`)
  },

  // Domains
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

  createFacet(data: CreateFacetDto) {
    return client.post<FacetMasterEntity>('/taxonomy', data)
  },

  updateFacet(id: number, data: UpdateFacetDto) {
    return client.put<FacetMasterEntity>(`/taxonomy/${id}`, data)
  },

  deleteFacet(id: number) {
    return client.delete(`/taxonomy/${id}`)
  },
}
