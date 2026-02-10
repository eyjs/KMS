<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import { LIFECYCLE_LABELS, FACET_TYPE_LABELS } from '@kms/shared'
import type { DocumentEntity, DomainMasterEntity, FacetMasterEntity } from '@kms/shared'

const router = useRouter()

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

const LIFECYCLE_TAG: Record<string, string> = {
  DRAFT: 'info',
  ACTIVE: 'success',
  DEPRECATED: 'danger',
}

const SECURITY_TAG: Record<string, { type: string; label: string }> = {
  PUBLIC: { type: 'success', label: '공개' },
  INTERNAL: { type: '', label: '사내용' },
  CONFIDENTIAL: { type: 'warning', label: '대외비' },
  SECRET: { type: 'danger', label: '기밀' },
}

onMounted(async () => {
  const { data } = await taxonomyApi.getDomainsFlat()
  domains.value = data
  // 전체 facet 로드 (도메인 무관)
  await loadFacets()
})

async function loadFacets(domain?: string) {
  const fetches = facetTypes.map((ft) =>
    taxonomyApi.getFacets(ft, domain).then(({ data }) => ({ ft, data })),
  )
  const results = await Promise.all(fetches)
  const opts: Record<string, FacetMasterEntity[]> = {}
  for (const { ft, data } of results) {
    opts[ft] = data.filter((f) => f.isActive)
  }
  facetOptions.value = opts
}

// 도메인 변경 시 해당 도메인의 facet만 로드
watch(domainFilter, async (domain) => {
  // 분류 필터 초기화
  for (const ft of facetTypes) {
    facetFilters.value[ft] = ''
  }
  await loadFacets(domain || undefined)
})

async function handleSearch() {
  loading.value = true
  searched.value = true
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
  } catch {
    results.value = []
    total.value = 0
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
  for (const ft of facetTypes) {
    facetFilters.value[ft] = ''
  }
  results.value = []
  total.value = 0
  searched.value = false
}
</script>

<template>
  <div style="height: 100%; overflow-y: auto">
    <h2 style="margin: 0 0 12px; font-size: 20px">통합 검색</h2>

    <!-- 검색 바 -->
    <el-card shadow="never" style="margin-bottom: 12px">
      <div style="display: flex; gap: 12px; align-items: flex-start">
        <el-input
          v-model="keyword"
          placeholder="파일명 또는 문서코드로 검색..."
          size="large"
          clearable
          @keyup.enter="handleSearch"
          style="flex: 1"
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
      <p style="color: #909399; margin-bottom: 12px; font-size: 13px">검색 결과 ({{ total }}건)</p>

      <div v-loading="loading">
        <div v-if="results.length > 0">
          <el-card
            v-for="doc in results"
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
              <div style="display: flex; gap: 6px; flex-shrink: 0">
                <el-tag :type="LIFECYCLE_TAG[doc.lifecycle] ?? 'info'" size="small">
                  {{ LIFECYCLE_LABELS[doc.lifecycle] ?? doc.lifecycle }}
                </el-tag>
                <el-tag :type="SECURITY_TAG[doc.securityLevel]?.type ?? ''" size="small">
                  {{ SECURITY_TAG[doc.securityLevel]?.label ?? doc.securityLevel }}
                </el-tag>
                <span style="color: #c0c4cc; font-size: 12px">
                  {{ new Date(doc.createdAt).toLocaleDateString('ko-KR') }}
                </span>
              </div>
            </div>
          </el-card>
        </div>
        <el-empty v-else description="검색 결과가 없습니다" />
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

    <el-empty v-else description="검색어를 입력하거나 분류를 선택 후 검색하세요" />
  </div>
</template>
