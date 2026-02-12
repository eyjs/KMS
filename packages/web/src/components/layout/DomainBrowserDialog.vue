<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDomainStore } from '@/stores/domain'
import { useNavigationStore } from '@/stores/navigation'
import type { DomainMasterEntity } from '@kms/shared'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const router = useRouter()
const domainStore = useDomainStore()
const navigationStore = useNavigationStore()

const searchKeyword = ref('')

const filteredDomains = computed(() => {
  const keyword = searchKeyword.value.toLowerCase().trim()
  if (!keyword) return domainStore.domainTree

  // 평면 검색
  return domainStore.domainsFlat.filter(
    (d) =>
      d.displayName.toLowerCase().includes(keyword) ||
      d.code.toLowerCase().includes(keyword),
  )
})

function selectDomain(domain: DomainMasterEntity) {
  navigationStore.visitDomain(domain.code)
  emit('update:visible', false)
  router.push(`/d/${domain.code}`)
}

function getDomainPath(domain: DomainMasterEntity): string {
  // 부모 경로 재구성
  const path: string[] = [domain.displayName]
  let current = domain
  while (current.parentCode) {
    const parent = domainStore.domainsFlat.find((d) => d.code === current.parentCode)
    if (parent) {
      path.unshift(parent.displayName)
      current = parent
    } else {
      break
    }
  }
  return path.join(' > ')
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      searchKeyword.value = ''
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="도메인 탐색"
    width="560px"
    :close-on-click-modal="true"
  >
    <el-input
      v-model="searchKeyword"
      placeholder="도메인 검색..."
      prefix-icon="Search"
      clearable
      size="large"
      style="margin-bottom: 16px"
    />

    <div style="max-height: 400px; overflow-y: auto">
      <!-- 검색 결과 (평면) -->
      <template v-if="searchKeyword.trim()">
        <div
          v-for="domain in filteredDomains"
          :key="domain.code"
          class="domain-item"
          @click="selectDomain(domain)"
        >
          <el-icon style="margin-right: 8px"><component is="FolderOpened" /></el-icon>
          <div>
            <div style="font-weight: 500">{{ domain.displayName }}</div>
            <div style="font-size: 12px; color: #909399">{{ getDomainPath(domain) }}</div>
          </div>
        </div>
        <el-empty v-if="filteredDomains.length === 0" description="검색 결과가 없습니다" :image-size="80" />
      </template>

      <!-- 트리 뷰 (검색어 없을 때) -->
      <template v-else>
        <el-tree
          :data="domainStore.domainTree"
          :props="{ label: 'displayName', children: 'children' }"
          node-key="code"
          default-expand-all
          @node-click="selectDomain"
        >
          <template #default="{ node, data }">
            <span style="display: flex; align-items: center; gap: 6px">
              <el-icon><component is="FolderOpened" /></el-icon>
              <span>{{ data.displayName }}</span>
              <span style="color: #909399; font-size: 12px">({{ data.code }})</span>
            </span>
          </template>
        </el-tree>
      </template>
    </div>
  </el-dialog>
</template>

<style scoped>
.domain-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.domain-item:hover {
  background: #f5f7fa;
}
</style>
