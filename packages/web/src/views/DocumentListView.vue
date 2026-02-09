<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import { useAuthStore } from '@/stores/auth'
import type { DocumentEntity, DomainMasterEntity, FacetMasterEntity, DocumentListQuery } from '@kms/shared'

const router = useRouter()
const auth = useAuthStore()

const documents = ref<DocumentEntity[]>([])
const domains = ref<DomainMasterEntity[]>([])
const carriers = ref<FacetMasterEntity[]>([])
const products = ref<FacetMasterEntity[]>([])
const docTypes = ref<FacetMasterEntity[]>([])
const total = ref(0)
const loading = ref(false)

const query = reactive<DocumentListQuery>({
  domain: undefined,
  lifecycle: undefined,
  carrier: undefined,
  product: undefined,
  docType: undefined,
  page: 1,
  size: 20,
})

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

async function fetchDocuments() {
  loading.value = true
  try {
    const { data } = await documentsApi.list(query)
    documents.value = data.data
    total.value = data.meta.total
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const [d, c, p, dt] = await Promise.all([
    taxonomyApi.getDomains(),
    taxonomyApi.getFacets('carrier'),
    taxonomyApi.getFacets('product'),
    taxonomyApi.getFacets('docType'),
  ])
  domains.value = d.data
  carriers.value = c.data
  products.value = p.data
  docTypes.value = dt.data
  fetchDocuments()
})

watch(() => [query.domain, query.lifecycle, query.carrier, query.product, query.docType], () => {
  query.page = 1
  fetchDocuments()
})

function goToDetail(id: string) {
  router.push(`/documents/${id}`)
}
</script>

<template>
  <div>
    <h2>문서 목록</h2>

    <!-- 필터 -->
    <el-card style="margin-bottom: 20px">
      <el-row :gutter="16">
        <el-col :span="4">
          <el-select v-model="query.domain" placeholder="도메인" clearable>
            <el-option v-for="d in domains" :key="d.code" :label="d.displayName" :value="d.code" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="query.lifecycle" placeholder="상태" clearable>
            <el-option label="DRAFT" value="DRAFT" />
            <el-option label="ACTIVE" value="ACTIVE" />
            <el-option label="DEPRECATED" value="DEPRECATED" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="query.carrier" placeholder="보험사" clearable filterable>
            <el-option v-for="c in carriers" :key="c.code" :label="c.displayName" :value="c.code" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="query.product" placeholder="상품" clearable filterable>
            <el-option v-for="p in products" :key="p.code" :label="p.displayName" :value="p.code" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="query.docType" placeholder="문서유형" clearable filterable>
            <el-option v-for="dt in docTypes" :key="dt.code" :label="dt.displayName" :value="dt.code" />
          </el-select>
        </el-col>
      </el-row>
    </el-card>

    <!-- 테이블 -->
    <el-table :data="documents" v-loading="loading" @row-click="(row: DocumentEntity) => goToDetail(row.id)" style="cursor: pointer">
      <el-table-column prop="fileName" label="파일명" min-width="200" />
      <el-table-column prop="domain" label="도메인" width="120" />
      <el-table-column label="상태" width="100">
        <template #default="{ row }">
          <el-tag :type="LIFECYCLE_TAG[row.lifecycle] ?? 'info'" size="small">
            {{ row.lifecycle }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="보안등급" width="100">
        <template #default="{ row }">
          <el-tag :type="SECURITY_TAG[row.securityLevel]?.type ?? ''" size="small">
            {{ SECURITY_TAG[row.securityLevel]?.label ?? row.securityLevel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="신선도" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.freshness" :type="row.freshness === 'FRESH' ? 'success' : row.freshness === 'WARNING' ? 'warning' : 'danger'" size="small">
            {{ row.freshness }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="fileType" label="형식" width="70" />
      <el-table-column label="생성일" width="120">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleDateString('ko-KR') }}
        </template>
      </el-table-column>
    </el-table>

    <!-- 페이지네이션 -->
    <div style="margin-top: 20px; display: flex; justify-content: center">
      <el-pagination
        v-model:current-page="query.page"
        :page-size="query.size"
        :total="total"
        layout="prev, pager, next, total"
        @current-change="fetchDocuments"
      />
    </div>
  </div>
</template>
