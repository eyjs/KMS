import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { taxonomyApi } from '@/api/taxonomy'
import type { DomainMasterEntity } from '@kms/shared'

export const useDomainStore = defineStore('domain', () => {
  const domainTree = ref<DomainMasterEntity[]>([])
  const domainsFlat = ref<DomainMasterEntity[]>([])
  const currentDomainCode = ref<string | null>(null)
  const domainsLoaded = ref(false)

  // 하위 호환
  const domains = domainsFlat

  const currentDomain = computed(() =>
    domainsFlat.value.find((d) => d.code === currentDomainCode.value) ?? null,
  )

  async function loadDomains() {
    if (domainsLoaded.value) return
    try {
      const [treeRes, flatRes] = await Promise.all([
        taxonomyApi.getDomains(),
        taxonomyApi.getDomainsFlat(),
      ])
      domainTree.value = treeRes.data
      domainsFlat.value = flatRes.data
      domainsLoaded.value = true
    } catch (e) {
      console.error('도메인 목록 로드 실패:', e)
    }
  }

  function setCurrentDomain(code: string) {
    currentDomainCode.value = code
  }

  async function reloadDomains() {
    domainsLoaded.value = false
    await loadDomains()
  }

  return {
    domains,
    domainTree,
    domainsFlat,
    currentDomainCode,
    currentDomain,
    domainsLoaded,
    loadDomains,
    reloadDomains,
    setCurrentDomain,
  }
})
