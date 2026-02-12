<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import { LIFECYCLE_LABELS } from '@kms/shared'
import type { DocumentEntity, DomainMasterEntity } from '@kms/shared'

const props = withDefaults(
  defineProps<{
    sourceDocument?: DocumentEntity
    excludeId?: string
    existingRelations?: Map<string, string>
    multiSelect?: boolean
    selectedIds?: string[]
  }>(),
  {
    multiSelect: false,
    selectedIds: () => [],
  },
)

const emit = defineEmits<{
  (e: 'select', doc: DocumentEntity): void
  (e: 'update:selectedIds', ids: string[]): void
}>()

const domains = ref<DomainMasterEntity[]>([])
const activeDomain = ref('')
const searchQuery = ref('')
const documents = ref<DocumentEntity[]>([])
const loading = ref(false)
const page = ref(1)
const totalPages = ref(0)
const PAGE_SIZE = 20

// 탭: all(도메인) | global(전역) | search(검색)
const activeTab = ref<'all' | 'global' | 'search'>('all')

onMounted(async () => {
  try {
    const { data } = await taxonomyApi.getDomainsFlat()
    domains.value = data
    // 기본 도메인은 첫 번째
    if (data.length > 0) {
      activeDomain.value = data[0].code
    }
  } catch {
    domains.value = []
  }
})

// 도메인 변경 시 문서 목록 다시 로드
watch(activeDomain, () => {
  page.value = 1
  if (activeTab.value === 'all') {
    loadDocuments()
  }
})

watch(activeTab, (tab) => {
  page.value = 1
  if (tab === 'all') loadDocuments()
  else if (tab === 'global') loadGlobalDocuments()
})

async function loadDocuments() {
  loading.value = true
  try {
    const { data } = await documentsApi.list({
      domain: activeDomain.value,
      page: page.value,
      size: PAGE_SIZE,
    })
    documents.value = data.data.filter((d: DocumentEntity) => d.id !== props.excludeId)
    totalPages.value = data.meta.totalPages
  } catch {
    documents.value = []
  } finally {
    loading.value = false
  }
}

async function loadGlobalDocuments() {
  loading.value = true
  try {
    const { data } = await documentsApi.list({
      page: page.value,
      size: PAGE_SIZE,
    })
    documents.value = data.data.filter((d: DocumentEntity) => d.id !== props.excludeId)
    totalPages.value = data.meta.totalPages
  } catch {
    documents.value = []
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  if (!searchQuery.value || searchQuery.value.length < 1) {
    documents.value = []
    return
  }
  activeTab.value = 'search'
  loading.value = true
  searchTimer = setTimeout(async () => {
    try {
      const { data } = await documentsApi.search({
        q: searchQuery.value,
        page: 1,
        size: PAGE_SIZE,
      })
      documents.value = data.data.filter((d: DocumentEntity) => d.id !== props.excludeId)
      totalPages.value = data.meta.totalPages
    } catch {
      documents.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

function handlePageChange(p: number) {
  page.value = p
  if (activeTab.value === 'all') loadDocuments()
  else if (activeTab.value === 'global') loadGlobalDocuments()
}

// 내부 선택 상태 (멀티 모드용)
const internalSelectedIds = ref<string[]>([...props.selectedIds])

// props.selectedIds 변경 시 동기화
watch(() => props.selectedIds, (ids) => {
  internalSelectedIds.value = [...ids]
})

function selectDoc(doc: DocumentEntity) {
  if (props.multiSelect) {
    toggleSelection(doc.id)
  } else {
    emit('select', doc)
  }
}

function toggleSelection(docId: string) {
  const idx = internalSelectedIds.value.indexOf(docId)
  if (idx >= 0) {
    internalSelectedIds.value.splice(idx, 1)
  } else {
    internalSelectedIds.value.push(docId)
  }
  emit('update:selectedIds', [...internalSelectedIds.value])
}

function isSelected(docId: string): boolean {
  return internalSelectedIds.value.includes(docId)
}

const displayList = computed(() => documents.value)

function lifecycleType(lifecycle: string): string {
  if (lifecycle === 'ACTIVE') return 'success'
  if (lifecycle === 'DRAFT') return 'info'
  return 'danger'
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden">
    <!-- 검색 -->
    <div style="padding: 8px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0">
      <el-input
        v-model="searchQuery"
        placeholder="문서 검색..."
        clearable
        size="small"
        @input="handleSearch"
        @clear="activeTab = 'all'; loadDocuments()"
      />
    </div>

    <!-- 탭 전환: 전역 / 도메인 -->
    <div style="padding: 4px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0">
      <el-radio-group v-model="activeTab" size="small">
        <el-radio-button value="global">전역 검색</el-radio-button>
        <el-radio-button value="all">도메인별</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 도메인 탭 (도메인별 모드일 때만) -->
    <div v-if="activeTab === 'all'" style="padding: 4px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0; overflow-x: auto; white-space: nowrap">
      <el-radio-group v-model="activeDomain" size="small">
        <el-radio-button
          v-for="d in domains"
          :key="d.code"
          :value="d.code"
        >
          {{ d.displayName }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 서브 탭 헤더 -->
    <div v-if="activeTab === 'search'" style="padding: 4px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0; font-size: 12px; color: #909399">
      검색 결과
      <el-button text size="small" @click="activeTab = 'global'; searchQuery = ''; loadGlobalDocuments()">초기화</el-button>
    </div>
    <div v-else-if="activeTab === 'global'" style="padding: 4px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0; font-size: 12px; color: #909399">
      전체 문서
    </div>
    <div v-else style="padding: 4px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0; font-size: 12px; color: #909399">
      {{ domains.find(d => d.code === activeDomain)?.displayName ?? '' }} 문서
    </div>

    <!-- 문서 목록 -->
    <div v-loading="loading" style="flex: 1; overflow: auto">
      <template v-if="displayList.length > 0">
        <div
          v-for="doc in displayList"
          :key="doc.id"
          class="doc-item"
          :class="{ selected: multiSelect && isSelected(doc.id) }"
          @click="selectDoc(doc)"
        >
          <el-checkbox
            v-if="multiSelect"
            :model-value="isSelected(doc.id)"
            style="margin-right: 8px"
            @click.stop
            @change="toggleSelection(doc.id)"
          />
          <div style="flex: 1; min-width: 0">
            <div style="display: flex; align-items: center; gap: 6px">
              <span style="font-size: 13px; font-weight: 500; color: #303133; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                {{ doc.fileName ?? doc.docCode ?? '(제목 없음)' }}
              </span>
              <el-tag
                v-if="props.existingRelations?.has(doc.id)"
                size="small"
                type="info"
                style="flex-shrink: 0"
              >
                {{ props.existingRelations.get(doc.id) }}
              </el-tag>
              <el-tag size="small" :type="lifecycleType(doc.lifecycle)">
                {{ LIFECYCLE_LABELS[doc.lifecycle] ?? doc.lifecycle }}
              </el-tag>
            </div>
            <div style="font-size: 11px; color: #909399; margin-top: 2px">
              <span v-if="doc.docCode" style="margin-right: 8px">{{ doc.docCode }}</span>
              <span v-if="doc.placementCount > 0">{{ doc.placementCount }}곳 배치</span>
              <span v-else>미배치</span>
            </div>
          </div>
        </div>
      </template>
      <div v-else-if="!loading" style="padding: 40px; text-align: center; color: #909399; font-size: 13px">
        <template v-if="activeTab === 'search'">검색 결과가 없습니다</template>
        <template v-else>문서가 없습니다</template>
      </div>
    </div>

    <!-- 페이지네이션 -->
    <div v-if="totalPages > 1" style="padding: 8px 12px; border-top: 1px solid #ebeef5; flex-shrink: 0; text-align: center">
      <el-pagination
        :current-page="page"
        :page-count="totalPages"
        layout="prev, pager, next"
        small
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.doc-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f2f3f5;
  cursor: pointer;
  transition: background 0.15s;
}

.doc-item:hover {
  background: #f5f7fa;
}

.doc-item.selected {
  background: #ecf5ff;
}
</style>
