<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { taxonomyApi } from '@/api/taxonomy'
import type { FacetMasterEntity, DomainMasterEntity } from '@kms/shared'

interface TreeNodeData {
  id: string
  label: string
  code: string
  facetType: string
  isLeaf: boolean
}

const props = defineProps<{
  domainCode: string
}>()

const emit = defineEmits<{
  select: [filters: Record<string, string>]
}>()

const treeRef = ref()
const treeData = ref<TreeNodeData[]>([])
const loading = ref(false)
const domain = ref<DomainMasterEntity | null>(null)

async function loadRoot() {
  loading.value = true
  try {
    const { data: domains } = await taxonomyApi.getDomains()
    domain.value = domains.find((d) => d.code === props.domainCode) ?? null
    if (!domain.value) return

    const requiredFacets = domain.value.requiredFacets as string[]
    if (requiredFacets.length === 0) {
      treeData.value = []
      return
    }

    const firstFacet = requiredFacets[0]
    const { data: facets } = await taxonomyApi.getFacets(firstFacet, props.domainCode)

    treeData.value = facets
      .filter((f) => f.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => ({
        id: `${firstFacet}:${f.code}`,
        label: f.displayName,
        code: f.code,
        facetType: firstFacet,
        isLeaf: requiredFacets.length === 1,
      }))
  } finally {
    loading.value = false
  }
}

async function handleLazyLoad(
  node: { level: number; data: TreeNodeData },
  resolve: (data: TreeNodeData[]) => void,
) {
  if (node.level === 0) {
    resolve(treeData.value)
    return
  }

  if (!domain.value) {
    resolve([])
    return
  }

  const requiredFacets = domain.value.requiredFacets as string[]
  const currentIdx = requiredFacets.indexOf(node.data.facetType)
  if (currentIdx < 0 || currentIdx >= requiredFacets.length - 1) {
    resolve([])
    return
  }

  const nextFacet = requiredFacets[currentIdx + 1]
  const { data: facets } = await taxonomyApi.getFacets(nextFacet, props.domainCode)

  const children = facets
    .filter((f) => f.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({
      id: `${nextFacet}:${f.code}`,
      label: f.displayName,
      code: f.code,
      facetType: nextFacet,
      isLeaf: currentIdx + 1 >= requiredFacets.length - 1,
    }))

  resolve(children)
}

function handleNodeClick(data: TreeNodeData, node: { parent: { data: TreeNodeData } | null; level: number }) {
  // 노드 경로에서 필터 구성
  const filters: Record<string, string> = {}
  let current: { data: TreeNodeData; parent: { data: TreeNodeData; parent: unknown } | null } | null = node as unknown as { data: TreeNodeData; parent: { data: TreeNodeData; parent: unknown } | null }
  while (current && current.data) {
    filters[current.data.facetType] = current.data.code
    current = current.parent as { data: TreeNodeData; parent: { data: TreeNodeData; parent: unknown } | null } | null
  }
  emit('select', filters)
}

function clearSelection() {
  treeRef.value?.setCurrentKey(null)
  emit('select', {})
}

watch(() => props.domainCode, () => {
  treeData.value = []
  loadRoot()
})

onMounted(loadRoot)
</script>

<template>
  <div class="classification-tree">
    <div style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ebeef5">
      <span style="font-size: 13px; font-weight: 600; color: #303133">분류 트리</span>
      <el-button text size="small" @click="clearSelection">초기화</el-button>
    </div>
    <div v-loading="loading" style="padding: 4px 0">
      <el-tree
        ref="treeRef"
        :data="treeData"
        :props="{ children: 'children', label: 'label', isLeaf: 'isLeaf' }"
        lazy
        :load="handleLazyLoad"
        node-key="id"
        highlight-current
        @node-click="handleNodeClick"
        style="background: transparent"
      >
        <template #default="{ data }">
          <span style="font-size: 13px">{{ data.label }}</span>
        </template>
      </el-tree>
      <el-empty v-if="!loading && treeData.length === 0" description="분류가 없습니다" :image-size="60" />
    </div>
  </div>
</template>

<style scoped>
.classification-tree {
  height: 100%;
  overflow-y: auto;
}
</style>
