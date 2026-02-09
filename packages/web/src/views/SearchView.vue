<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import type { DocumentEntity, DomainMasterEntity, PaginatedResponse } from '@kms/shared'

const router = useRouter()

const keyword = ref('')
const domainFilter = ref<string>()
const lifecycleFilter = ref<string>()
const domains = ref<DomainMasterEntity[]>([])

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
  const { data } = await taxonomyApi.getDomains()
  domains.value = data
})

async function handleSearch() {
  loading.value = true
  searched.value = true
  try {
    const { data } = await documentsApi.search({
      q: keyword.value || undefined,
      domain: domainFilter.value || undefined,
      lifecycle: lifecycleFilter.value || undefined,
      page: page.value,
      size: 20,
    })
    results.value = data.data
    total.value = data.meta.total
  } catch {
    // search API가 아직 없을 수 있으므로 기존 list API로 fallback
    try {
      const { data } = await documentsApi.list({
        domain: domainFilter.value,
        lifecycle: lifecycleFilter.value as 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | undefined,
        page: page.value,
        size: 20,
      })
      // 키워드 필터링 (클라이언트 사이드)
      if (keyword.value) {
        const kw = keyword.value.toLowerCase()
        results.value = data.data.filter((d) => (d.fileName ?? '').toLowerCase().includes(kw))
        total.value = results.value.length
      } else {
        results.value = data.data
        total.value = data.meta.total
      }
    } catch {
      results.value = []
      total.value = 0
    }
  } finally {
    loading.value = false
  }
}

function goToDocument(doc: DocumentEntity) {
  router.push(`/d/${doc.domain}/doc/${doc.id}`)
}

function buildClassificationPath(doc: DocumentEntity): string {
  const parts: string[] = [doc.domain, ...Object.values(doc.classifications)]
  return parts.join(' > ')
}
</script>

<template>
  <div>
    <h2 style="margin: 0 0 20px; font-size: 22px">통합 검색</h2>

    <!-- 검색 바 -->
    <el-card shadow="never" style="margin-bottom: 20px">
      <div style="display: flex; gap: 12px; align-items: flex-start">
        <el-input
          v-model="keyword"
          placeholder="파일명으로 검색..."
          size="large"
          clearable
          @keyup.enter="handleSearch"
          style="flex: 1"
        />
        <el-button type="primary" size="large" :loading="loading" @click="handleSearch">
          검색
        </el-button>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 12px">
        <el-select v-model="domainFilter" placeholder="도메인" clearable size="small" style="width: 160px">
          <el-option v-for="d in domains" :key="d.code" :label="d.displayName" :value="d.code" />
        </el-select>
        <el-select v-model="lifecycleFilter" placeholder="상태" clearable size="small" style="width: 120px">
          <el-option label="DRAFT" value="DRAFT" />
          <el-option label="ACTIVE" value="ACTIVE" />
          <el-option label="DEPRECATED" value="DEPRECATED" />
        </el-select>
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
                <div style="font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 4px">
                  {{ doc.fileName ?? '(메타데이터만)' }}
                </div>
                <div style="font-size: 12px; color: #909399">
                  {{ buildClassificationPath(doc) }}
                </div>
              </div>
              <div style="display: flex; gap: 6px; flex-shrink: 0">
                <el-tag :type="LIFECYCLE_TAG[doc.lifecycle] ?? 'info'" size="small">
                  {{ doc.lifecycle }}
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

    <el-empty v-else description="검색어를 입력하고 검색 버튼을 클릭하세요" />
  </div>
</template>
