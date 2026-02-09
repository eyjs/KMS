import { client } from './client'
import type { DomainMasterEntity, FacetMasterEntity } from '@kms/shared'

export const taxonomyApi = {
  getDomains() {
    return client.get<DomainMasterEntity[]>('/domains')
  },

  getFacets(facetType: string, domain?: string) {
    return client.get<FacetMasterEntity[]>(`/taxonomy/${facetType}`, {
      params: domain ? { domain } : undefined,
    })
  },
}
