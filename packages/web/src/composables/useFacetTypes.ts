import { ref, computed } from 'vue'
import { taxonomyApi } from '@/api/taxonomy'
import type { FacetTypeMasterEntity } from '@kms/shared'

// 모듈 레벨 싱글턴 캐시
const facetTypes = ref<FacetTypeMasterEntity[]>([])
let loaded = false
let loading: Promise<void> | null = null

export function useFacetTypes() {
  async function loadFacetTypes(force = false): Promise<void> {
    if (loaded && !force) return
    if (loading) return loading

    loading = taxonomyApi.getFacetTypes()
      .then(({ data }) => {
        facetTypes.value = data
        loaded = true
      })
      .catch(() => {
        // 로드 실패 시 빈 배열 유지
      })
      .finally(() => {
        loading = null
      })

    return loading
  }

  function facetLabel(key: string): string {
    const ft = facetTypes.value.find((t) => t.code === key)
    return ft?.displayName ?? key
  }

  const allFacetTypeCodes = computed<string[]>(() =>
    facetTypes.value.map((t) => t.code),
  )

  return {
    facetTypes,
    loadFacetTypes,
    facetLabel,
    allFacetTypeCodes,
  }
}
