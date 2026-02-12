<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { documentsApi } from '@/api/documents'
import { placementsApi } from '@/api/placements'
import { useDomainStore } from '@/stores/domain'
import type { DocumentEntity } from '@kms/shared'
import { useSearchHistory } from '@/composables/useSearchHistory'
import StatusTag from '@/components/common/StatusTag.vue'
import BulkPlacementDialog from '@/components/document/BulkPlacementDialog.vue'

const router = useRouter()
const route = useRoute()
const domainStore = useDomainStore()
const { searchHistory, addSearch, clearHistory } = useSearchHistory()

const keyword = ref('')
const domainFilter = ref<string>()
const lifecycleFilter = ref<string>()
const orphanFilter = ref(false)

type SearchResult = DocumentEntity & { domainTags?: Array<{ code: string; name: string }> }

const results = ref<SearchResult[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const searched = ref(false)
const errorState = ref(false)
const isRestoring = ref(false)

// 정렬
type SortField = 'createdAt' | 'updatedAt' | 'fileName' | 'fileSize'
type SortOrder = 'asc' | 'desc'
const VALID_SORT_FIELDS: SortField[] = ['createdAt', 'updatedAt', 'fileName', 'fileSize']
const sortField = ref<SortField>('updatedAt')
const sortOrder = ref<SortOrder>('desc')

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'updatedAt:desc', label: '최근 수정순' },
  { value: 'createdAt:desc', label: '최근 생성순' },
  { value: 'fileName:asc', label: '파일명순' },
  { value: 'fileSize:desc', label: '파일 크기순' },
]

const currentSortValue = computed(() => `${sortField.value}:${sortOrder.value}`)

function handleSortChange(value: string) {
  const [field, order] = value.split(':') as [SortField, SortOrder]
  sortField.value = field
  sortOrder.value = order
  if (searched.value) {
    page.value = 1
    handleSearch()
  }
}

// 검색 이력 자동완성
const searchInputRef = ref<{ focus: () => void } | null>(null)

function querySearch(queryString: string, cb: (results: Array<{ value: string }>) => void) {
  const suggestions = searchHistory.value
    .filter((e) => !queryString || e.query.includes(queryString))
    .slice(0, 5)
    .map((e) => ({ value: e.query }))
  cb(suggestions)
}

function handleSelectHistory(item: { value: string }) {
  keyword.value = item.value
  handleSearch()
}

onMounted(async () => {
  await domainStore.loadDomains()
  restoreFromQuery()
})

function restoreFromQuery() {
  const q = route.query
  if (!q.q && !q.domain && !q.lifecycle && !q.orphan && !q.sort) {
    nextTick(() => searchInputRef.value?.focus())
    return
  }
  isRestoring.value = true
  if (q.q) keyword.value = q.q as string
  if (q.domain) domainFilter.value = q.domain as string
  if (q.lifecycle) lifecycleFilter.value = q.lifecycle as string
  if (q.orphan === 'true') orphanFilter.value = true

  // 정렬 복원
  const sortParam = q.sort as string
  if (sortParam && sortParam.includes(':')) {
    const [field, order] = sortParam.split(':') as [string, string]
    if (VALID_SORT_FIELDS.includes(field as SortField)) {
      sortField.value = field as SortField
      sortOrder.value = (order === 'asc' ? 'asc' : 'desc') as SortOrder
    }
  }

  isRestoring.value = false
  handleSearch()
  nextTick(() => searchInputRef.value?.focus())
}

function syncToQuery() {
  const query: Record<string, string> = {}
  if (keyword.value) query.q = keyword.value
  if (domainFilter.value) query.domain = domainFilter.value
  if (lifecycleFilter.value) query.lifecycle = lifecycleFilter.value
  if (orphanFilter.value) query.orphan = 'true'
  if (currentSortValue.value !== 'updatedAt:desc') query.sort = currentSortValue.value
  router.replace({ query })
}

async function handleSearch() {
  if (loading.value) return
  loading.value = true
  searched.value = true
  errorState.value = false
  try {
    const { data } = await documentsApi.search({
      q: keyword.value || undefined,
      domain: domainFilter.value || undefined,
      lifecycle: lifecycleFilter.value || undefined,
      orphan: orphanFilter.value || undefined,
      page: page.value,
      size: pageSize.value,
    })
    results.value = data.data
    total.value = data.meta.total
    // 검색 이력 저장
    if (keyword.value.trim()) {
      addSearch(keyword.value)
    }
    syncToQuery()
  } catch {
    errorState.value = true
    results.value = []
    total.value = 0
    ElMessage.error('검색 중 오류가 발생했습니다')
  } finally {
    loading.value = false
  }
}

function handlePageChange(newPage: number) {
  page.value = newPage
  handleSearch()
}

function goToDocument(doc: SearchResult) {
  // domainTags 또는 placements에서 도메인 코드 추출
  const domainCode = doc.domainTags?.[0]?.code ?? doc.placements?.[0]?.domainCode ?? '_'
  router.push(`/d/${domainCode}/doc/${doc.id}`)
}

function clearFilters() {
  keyword.value = ''
  domainFilter.value = undefined
  lifecycleFilter.value = undefined
  orphanFilter.value = false
  sortField.value = 'updatedAt'
  sortOrder.value = 'desc'
  results.value = []
  total.value = 0
  page.value = 1
  searched.value = false
  errorState.value = false
  router.replace({ query: {} })
}

function handleRetry() {
  handleSearch()
}

// debounce 타이머
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 자동 검색 (debounce)
watch(keyword, (newVal) => {
  if (isRestoring.value) return

  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  // 2글자 이상일 때만 자동 검색
  if (newVal.trim().length >= 2) {
    debounceTimer = setTimeout(() => {
      page.value = 1
      handleSearch()
    }, 300)
  }
})

// 컴포넌트 언마운트 시 타이머 정리
onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})

// 멀티셀렉트
const selectedDocIds = ref<string[]>([])
const showBulkPlacement = ref(false)

function isSelected(docId: string): boolean {
  return selectedDocIds.value.includes(docId)
}

function toggleSelection(docId: string, event: Event) {
  event.stopPropagation()
  const idx = selectedDocIds.value.indexOf(docId)
  if (idx >= 0) {
    selectedDocIds.value.splice(idx, 1)
  } else {
    selectedDocIds.value.push(docId)
  }
}

function clearSelection() {
  selectedDocIds.value = []
}

function openBulkPlacement() {
  if (selectedDocIds.value.length === 0) return
  showBulkPlacement.value = true
}

function handleBulkPlacementSuccess() {
  showBulkPlacement.value = false
  selectedDocIds.value = []
  handleSearch()
}

// 빠른 배치 (단일)
const quickPlacementDocId = ref<string | null>(null)
const quickPlacementVisible = ref(false)

function openQuickPlacement(docId: string, event: Event) {
  event.stopPropagation()
  quickPlacementDocId.value = docId
  quickPlacementVisible.value = true
}

function handleQuickPlacementSuccess() {
  quickPlacementDocId.value = null
  // 결과 새로고침
  handleSearch()
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="search-view">
    <h2 style="margin: 0 0 12px; font-size: 20px">통합 검색</h2>

    <!-- 검색 바 -->
    <el-card shadow="never" style="margin-bottom: 12px">
      <div style="display: flex; gap: 12px; align-items: flex-start">
        <el-autocomplete
          ref="searchInputRef"
          v-model="keyword"
          :fetch-suggestions="querySearch"
          placeholder="파일명 또는 문서코드로 검색..."
          size="large"
          clearable
          style="flex: 1"
          @keyup.enter="handleSearch"
          @select="handleSelectHistory"
        />
        <el-button type="primary" size="large" :loading="loading" @click="handleSearch">
          검색
        </el-button>
      </div>

      <!-- 필터 영역 -->
      <div style="margin-top: 12px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center">
        <el-select v-model="domainFilter" placeholder="도메인" clearable size="small" style="width: 160px">
          <el-option
            v-for="d in domainStore.domainsFlat"
            :key="d.code"
            :label="d.displayName"
            :value="d.code"
          />
        </el-select>
        <el-select v-model="lifecycleFilter" placeholder="상태" clearable size="small" style="width: 120px">
          <el-option label="임시저장" value="DRAFT" />
          <el-option label="사용중" value="ACTIVE" />
          <el-option label="만료" value="DEPRECATED" />
        </el-select>
        <el-checkbox v-model="orphanFilter" size="small" label="미배치 문서만" />
        <el-button size="small" text @click="clearFilters">초기화</el-button>
      </div>
    </el-card>

    <!-- 결과 -->
    <div v-if="searched">
      <!-- 결과 헤더: 건수 + 정렬 + 일괄 배치 -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="color: #909399; font-size: 13px">검색 결과 ({{ total.toLocaleString() }}건)</span>
          <template v-if="selectedDocIds.length > 0">
            <el-button type="primary" size="small" @click="openBulkPlacement">
              일괄 배치 ({{ selectedDocIds.length.toLocaleString() }}건)
            </el-button>
            <el-button size="small" text @click="clearSelection">선택 해제</el-button>
          </template>
        </div>
        <el-select
          :model-value="currentSortValue"
          size="small"
          style="width: 140px"
          @change="handleSortChange"
        >
          <el-option
            v-for="opt in SORT_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>

      <div v-loading="loading">
        <!-- 에러 상태 -->
        <div v-if="errorState" style="text-align: center; padding: 40px 0">
          <el-empty description="검색 중 오류가 발생했습니다">
            <el-button type="primary" @click="handleRetry">다시 시도</el-button>
          </el-empty>
        </div>
        <!-- 결과 있음 -->
        <div v-else-if="results.length > 0">
          <el-card
            v-for="doc in results"
            :key="doc.id"
            shadow="never"
            style="margin-bottom: 8px; cursor: pointer"
            :class="{ 'selected-card': isSelected(doc.id) }"
            :body-style="{ padding: '12px 16px' }"
            @click="goToDocument(doc)"
          >
            <div style="display: flex; justify-content: space-between; align-items: flex-start">
              <!-- 체크박스 (멀티셀렉트용) -->
              <el-checkbox
                :model-value="isSelected(doc.id)"
                style="margin-right: 12px"
                @click="toggleSelection(doc.id, $event)"
              />
              <div style="min-width: 0; flex: 1">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
                  <span v-if="doc.docCode" style="font-family: monospace; font-size: 12px; color: #909399">
                    {{ doc.docCode }}
                  </span>
                  <span style="font-size: 14px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                    {{ doc.fileName ?? '(메타데이터만)' }}
                  </span>
                </div>
                <!-- 배치된 도메인 태그 -->
                <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; align-items: center">
                  <template v-if="doc.domainTags?.length">
                    <el-tag
                      v-for="tag in doc.domainTags"
                      :key="tag.code"
                      size="small"
                      type="info"
                    >
                      {{ tag.name }}
                    </el-tag>
                  </template>
                  <template v-else>
                    <el-tag size="small" type="warning">미배치</el-tag>
                    <el-button
                      size="small"
                      type="primary"
                      text
                      @click="openQuickPlacement(doc.id, $event)"
                    >
                      빠른 배치
                    </el-button>
                  </template>
                  <span v-if="doc.fileSize" style="color: #c0c4cc; font-size: 11px; align-self: center; margin-left: 4px">
                    {{ formatFileSize(doc.fileSize) }}
                  </span>
                </div>
              </div>
              <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center; margin-left: 12px">
                <StatusTag type="lifecycle" :value="doc.lifecycle" />
                <StatusTag type="security" :value="doc.securityLevel" />
                <span style="color: #c0c4cc; font-size: 12px">
                  {{ new Date(doc.updatedAt).toLocaleDateString('ko-KR') }}
                </span>
              </div>
            </div>
          </el-card>
        </div>
        <!-- 빈 결과 -->
        <el-empty v-else description="검색 결과가 없습니다">
          <template #default>
            <p style="color: #909399; font-size: 13px; margin: 0 0 12px">다른 도메인이나 필터를 시도해보세요</p>
            <el-button type="primary" size="small" @click="clearFilters">필터 초기화</el-button>
          </template>
        </el-empty>
      </div>

      <!-- 페이지네이션 -->
      <div v-if="total > pageSize" style="margin-top: 16px; display: flex; justify-content: center">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 미검색 상태 -->
    <div v-else>
      <!-- 최근 검색어 -->
      <div v-if="searchHistory.length > 0" style="margin-bottom: 16px">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px">
          <span style="color: #606266; font-size: 13px; font-weight: 600">최근 검색</span>
          <el-button size="small" text @click="clearHistory">전체 삭제</el-button>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <el-tag
            v-for="entry in searchHistory.slice(0, 5)"
            :key="entry.query"
            style="cursor: pointer"
            @click="keyword = entry.query; handleSearch()"
          >
            {{ entry.query }}
          </el-tag>
        </div>
      </div>
      <el-empty description="검색어를 입력하거나 필터를 선택 후 검색하세요" />
    </div>

    <!-- 빠른 배치 다이얼로그 (단일) -->
    <BulkPlacementDialog
      v-if="quickPlacementDocId"
      v-model:visible="quickPlacementVisible"
      :document-ids="[quickPlacementDocId]"
      @success="handleQuickPlacementSuccess"
    />

    <!-- 일괄 배치 다이얼로그 (멀티셀렉트) -->
    <BulkPlacementDialog
      v-model:visible="showBulkPlacement"
      :document-ids="selectedDocIds"
      @success="handleBulkPlacementSuccess"
    />
  </div>
</template>

<style scoped>
.search-view {
  height: 100%;
  overflow-y: auto;
}

.selected-card {
  background-color: #ecf5ff;
  border-color: #409eff;
}
</style>
