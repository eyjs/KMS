import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { taxonomyApi } from '@/api/taxonomy'
import type { DomainMasterEntity, FacetMasterEntity } from '@kms/shared'

interface TreeNode {
  label: string
  code: string
  facetType: string
  children?: TreeNode[]
  count?: number
}

export const useDomainStore = defineStore('domain', () => {
  const domains = ref<DomainMasterEntity[]>([])
  const currentDomainCode = ref<string | null>(null)
  const selectedTreeNode = ref<TreeNode | null>(null)
  const treeFilters = ref<Record<string, string>>({})
  const domainsLoaded = ref(false)

  const currentDomain = computed(() =>
    domains.value.find((d) => d.code === currentDomainCode.value) ?? null,
  )

  async function loadDomains() {
    if (domainsLoaded.value) return
    try {
      const { data } = await taxonomyApi.getDomains()
      domains.value = data
      domainsLoaded.value = true
    } catch (e) {
      console.error('도메인 목록 로드 실패:', e)
    }
  }

  function setCurrentDomain(code: string) {
    currentDomainCode.value = code
    selectedTreeNode.value = null
    treeFilters.value = {}
  }

  function selectTreeNode(node: TreeNode | null) {
    selectedTreeNode.value = node
    if (!node) {
      treeFilters.value = {}
      return
    }

    // 선택된 노드까지의 경로에서 필터 구성
    treeFilters.value = {}
    treeFilters.value[node.facetType] = node.code
  }

  function setTreeFilters(filters: Record<string, string>) {
    treeFilters.value = filters
  }

  function clearSelection() {
    selectedTreeNode.value = null
    treeFilters.value = {}
  }

  return {
    domains,
    currentDomainCode,
    currentDomain,
    selectedTreeNode,
    treeFilters,
    domainsLoaded,
    loadDomains,
    setCurrentDomain,
    selectTreeNode,
    setTreeFilters,
    clearSelection,
  }
})
