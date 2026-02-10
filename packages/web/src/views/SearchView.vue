<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import { FACET_TYPE_LABELS } from '@kms/shared'
import type { DocumentEntity, DomainMasterEntity, FacetMasterEntity } from '@kms/shared'
import { useSearchHistory } from '@/composables/useSearchHistory'
import StatusTag from '@/components/common/StatusTag.vue'

const router = useRouter()
const route = useRoute()
const { searchHistory, addSearch, clearHistory } = useSearchHistory()

const keyword = ref('')
const domainFilter = ref<string>()
const lifecycleFilter = ref<string>()
const domains = ref<DomainMasterEntity[]>([])

// 분류 필터
const facetFilters = ref<Record<string, string>>({})
const facetOptions = ref<Record<string, FacetMasterEntity[]>>({})
const facetTypes = ['carrier', 'product', 'docType']

const results = ref<DocumentEntity[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const searched = ref(false)
const errorState = ref(false)
const isRestoring = ref(false)

// 정렬
type SortOption = 'relevance' | 'latest' | 'name' | 'code'
const VALID_SORTS: SortOption[] = ['relevance', 'latest', 'name', 'code']
const sortBy = ref<SortOption>('relevance')
const SORT_OPTIONS = [
  { value: 'relevance', label: '관련도순' },
  { value: 'latest', label: '최신순' },
  { value: 'name', label: '이름순' },
  { value: 'code', label: '코드순' },
] as const

const sortedResults = computed(() => {
  const items = [...results.value]
  switch (sortBy.value) {
    case 'latest':
      return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    case 'name':
      return items.sort((a, b) => (a.fileName ?? '').localeCompare(b.fileName ?? '', 'ko'))
    case 'code':
      return items.sort((a, b) => (a.docCode ?? '').localeCompare(b.docCode ?? ''))
    default:
      return items
  }
})

// 검색 이력 자동완성
const searchInputRef = ref<{ focus: () => void } | null>(null)

function querySearch(queryString: string, cb: (results: { value: string }[]) => void) {
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
  const { data } = await taxonomyApi.getDomainsFlat()
  domains.value = data
  await loadFacets()
  // URL에서 필터 복원
  restoreFromQuery()
})

async function restoreFromQuery() {
  const q = route.query
  if (!q.q && !q.domain && !q.lifecycle && !facetTypes.some((ft) => q[ft])) {
    // query param 없으면 복원 불필요
    nextTick(() => searchInputRef.value?.focus())
    return
  }
  // 워처가 facet 필터를 초기화하지 않도록 가드
  isRestoring.value = true
  if (q.q) keyword.value = q.q as string
  if (q.domain) domainFilter.value = q.domain as string
  if (q.lifecycle) lifecycleFilter.value = q.lifecycle as string
  const sortParam = q.sort as string
  if (sortParam && VALID_SORTS.includes(sortParam as SortOption)) {
    sortBy.value = sortParam as SortOption
  }
  // 도메인이 변경되면 해당 도메인 facet을 로드한 뒤 필터 복원
  if (q.domain) {
    await loadFacets(q.domain as string)
  }
  for (const ft of facetTypes) {
    if (q[ft]) facetFilters.value[ft] = q[ft] as string
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
  if (sortBy.value !== 'relevance') query.sort = sortBy.value
  for (const ft of facetTypes) {
    if (facetFilters.value[ft]) query[ft] = facetFilters.value[ft]
  }
  router.replace({ query })
}

async function loadFacets(domain?: string) {
  const fetches = facetTypes.map((ft) =>
    taxonomyApi.getFacets(ft, domain).then(({ data }) => ({ ft, data })),
  )
  const res = await Promise.all(fetches)
  const opts: Record<string, FacetMasterEntity[]> = {}
  for (const { ft, data } of res) {
    opts[ft] = data.filter((f) => f.isActive)
  }
  facetOptions.value = opts
}

// 정렬 변경 시 URL 동기화
watch(sortBy, () => {
  if (searched.value) syncToQuery()
})

// 도메인 변경 시 해당 도메인의 facet만 로드 (URL 복원 중에는 스킵)
watch(domainFilter, async (domain) => {
  if (isRestoring.value) return
  for (const ft of facetTypes) {
    facetFilters.value[ft] = ''
  }
  await loadFacets(domain || undefined)
})

async function handleSearch() {
  if (loading.value) return
  loading.value = true
  searched.value = true
  errorState.value = false
  try {
    // 분류 필터 구성
    const classifications: Record<string, string> = {}
    for (const [ft, val] of Object.entries(facetFilters.value)) {
      if (val) classifications[ft] = val
    }
    const classificationsParam = Object.keys(classifications).length > 0
      ? JSON.stringify(classifications)
      : undefined

    const { data } = await documentsApi.search({
      q: keyword.value || undefined,
      domain: domainFilter.value || undefined,
      lifecycle: lifecycleFilter.value || undefined,
      classifications: classificationsParam,
      page: page.value,
      size: 20,
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

function goToDocument(doc: DocumentEntity) {
  router.push(`/d/${doc.domain}/doc/${doc.id}`)
}

function buildClassificationPath(doc: DocumentEntity): string {
  const domainObj = domains.value.find((d) => d.code === doc.domain)
  const domainName = domainObj?.displayName ?? doc.domain
  const facetParts: string[] = []
  for (const ft of facetTypes) {
    const code = doc.classifications[ft]
    if (!code) continue
    const opts = facetOptions.value[ft] ?? []
    const match = opts.find((o) => o.code === code)
    facetParts.push(match?.displayName ?? code)
  }
  return [domainName, ...facetParts].join(' > ')
}

function clearFilters() {
  keyword.value = ''
  domainFilter.value = undefined
  lifecycleFilter.value = undefined
  sortBy.value = 'relevance'
  for (const ft of facetTypes) {
    facetFilters.value[ft] = ''
  }
  results.value = []
  total.value = 0
  searched.value = false
  errorState.value = false
  router.replace({ query: {} })
}

function handleRetry() {
  handleSearch()
}
</script>

<template>
  <div style="height: 100%; overflow-y: auto">
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
      <div style="margin-top: 12px; display: flex; gap: 12px; flex-wrap: wrap">
        <el-select v-model="domainFilter" placeholder="도메인" clearable size="small" style="width: 160px">
          <el-option v-for="d in domains" :key="d.code" :label="d.displayName" :value="d.code" />
        </el-select>
        <el-select v-model="lifecycleFilter" placeholder="상태" clearable size="small" style="width: 120px">
          <el-option label="임시저장" value="DRAFT" />
          <el-option label="사용중" value="ACTIVE" />
          <el-option label="만료" value="DEPRECATED" />
        </el-select>
        <el-select
          v-for="ft in facetTypes"
          :key="ft"
          v-model="facetFilters[ft]"
          :placeholder="FACET_TYPE_LABELS[ft] ?? ft"
          clearable
          filterable
          size="small"
          style="width: 160px"
        >
          <el-option
            v-for="opt in (facetOptions[ft] ?? [])"
            :key="opt.code"
            :label="opt.displayName"
            :value="opt.code"
          />
        </el-select>
        <el-button size="small" text @click="clearFilters">초기화</el-button>
      </div>
    </el-card>

    <!-- 결과 -->
    <div v-if="searched">
      <!-- 결과 헤더: 건수 + 정렬 -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
        <span style="color: #909399; font-size: 13px">검색 결과 ({{ total }}건)</span>
        <el-select v-model="sortBy" size="small" style="width: 120px">
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
        <div v-else-if="sortedResults.length > 0">
          <el-card
            v-for="doc in sortedResults"
            :key="doc.id"
            shadow="never"
            style="margin-bottom: 8px; cursor: pointer"
            :body-style="{ padding: '12px 16px' }"
            @click="goToDocument(doc)"
          >
            <div style="display: flex; justify-content: space-between; align-items: flex-start">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
                  <span v-if="doc.docCode" style="font-family: monospace; font-size: 12px; color: #909399">
                    {{ doc.docCode }}
                  </span>
                  <span style="font-size: 14px; font-weight: 600; color: #303133">
                    {{ doc.fileName ?? '(메타데이터만)' }}
                  </span>
                </div>
                <div style="font-size: 12px; color: #909399">
                  {{ buildClassificationPath(doc) }}
                </div>
              </div>
              <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center">
                <StatusTag type="lifecycle" :value="doc.lifecycle" />
                <StatusTag type="security" :value="doc.securityLevel" />
                <span style="color: #c0c4cc; font-size: 12px">
                  {{ new Date(doc.createdAt).toLocaleDateString('ko-KR') }}
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
      <div v-if="total > 20" style="margin-top: 16px; display: flex; justify-content: center">
        <el-pagination
          v-model:current-page="page"
          :page-size="20"
          :total="total"
          layout="prev, pager, next"
          @current-change="handleSearch"
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
      <el-empty description="검색어를 입력하거나 분류를 선택 후 검색하세요" />
    </div>
  </div>
</template>
