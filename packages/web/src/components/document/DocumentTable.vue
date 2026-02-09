<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { documentsApi } from '@/api/documents'
import type { DocumentEntity, DocumentListQuery } from '@kms/shared'

const props = defineProps<{
  domainCode: string
  filters?: Record<string, string>
}>()

const emit = defineEmits<{
  select: [doc: DocumentEntity]
  dblclick: [doc: DocumentEntity]
}>()

const documents = ref<DocumentEntity[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const lifecycleFilter = ref<string>()
const sortField = ref('createdAt')
const sortOrder = ref<'asc' | 'desc'>('desc')
const selectedRow = ref<DocumentEntity | null>(null)

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
    const query: DocumentListQuery = {
      domain: props.domainCode,
      lifecycle: lifecycleFilter.value as DocumentListQuery['lifecycle'],
      classifications: props.filters && Object.keys(props.filters).length > 0
        ? JSON.stringify(props.filters)
        : undefined,
      page: page.value,
      size: size.value,
      sort: sortField.value,
      order: sortOrder.value,
    }
    const { data } = await documentsApi.list(query)
    documents.value = data.data
    total.value = data.meta.total
  } finally {
    loading.value = false
  }
}

function handleRowClick(row: DocumentEntity) {
  selectedRow.value = row
  emit('select', row)
}

function handleRowDblClick(row: DocumentEntity) {
  emit('dblclick', row)
}

function getRowClassName({ row }: { row: DocumentEntity }): string {
  return row.id === selectedRow.value?.id ? 'selected-row' : ''
}

function handleSort(sort: { prop: string; order: string | null }) {
  if (sort.prop && sort.order) {
    sortField.value = sort.prop
    sortOrder.value = sort.order === 'ascending' ? 'asc' : 'desc'
    fetchDocuments()
  }
}

watch(
  () => [props.domainCode, props.filters],
  () => {
    page.value = 1
    fetchDocuments()
  },
  { deep: true },
)

watch(lifecycleFilter, () => {
  page.value = 1
  fetchDocuments()
})

onMounted(fetchDocuments)

defineExpose({ refresh: fetchDocuments })
</script>

<template>
  <div>
    <!-- 필터 바 -->
    <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center">
      <el-select
        v-model="lifecycleFilter"
        placeholder="상태"
        clearable
        size="small"
        style="width: 120px"
      >
        <el-option label="DRAFT" value="DRAFT" />
        <el-option label="ACTIVE" value="ACTIVE" />
        <el-option label="DEPRECATED" value="DEPRECATED" />
      </el-select>
      <span style="font-size: 12px; color: #909399; margin-left: auto">
        {{ total }}건
        <template v-if="Object.keys(props.filters ?? {}).length > 0">
          (필터 적용)
        </template>
      </span>
    </div>

    <!-- 테이블 -->
    <el-table
      :data="documents"
      v-loading="loading"
      size="small"
      @row-click="handleRowClick"
      @row-dblclick="handleRowDblClick"
      @sort-change="handleSort"
      :row-class-name="getRowClassName"
      style="cursor: pointer"
      :header-cell-style="{ background: '#fafafa', color: '#606266' }"
    >
      <el-table-column label="파일명" min-width="200" sortable="custom" prop="fileName" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.fileName ?? '(메타데이터만)' }}
        </template>
      </el-table-column>
      <el-table-column label="상태" width="90">
        <template #default="{ row }">
          <el-tag :type="LIFECYCLE_TAG[row.lifecycle] ?? 'info'" size="small">
            {{ row.lifecycle }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="보안" width="80">
        <template #default="{ row }">
          <el-tag :type="SECURITY_TAG[row.securityLevel]?.type ?? ''" size="small">
            {{ SECURITY_TAG[row.securityLevel]?.label ?? row.securityLevel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="신선도" width="80">
        <template #default="{ row }">
          <el-tag
            v-if="row.freshness"
            :type="row.freshness === 'FRESH' ? 'success' : row.freshness === 'WARNING' ? 'warning' : 'danger'"
            size="small"
          >
            {{ row.freshness }}
          </el-tag>
          <span v-else style="color: #c0c4cc">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="fileType" label="형식" width="60" />
      <el-table-column label="생성일" width="100" prop="createdAt" sortable="custom">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleDateString('ko-KR') }}
        </template>
      </el-table-column>
    </el-table>

    <!-- 페이지네이션 -->
    <div style="margin-top: 12px; display: flex; justify-content: center">
      <el-pagination
        v-model:current-page="page"
        :page-size="size"
        :total="total"
        layout="prev, pager, next"
        small
        @current-change="fetchDocuments"
      />
    </div>
  </div>
</template>

<style>
.selected-row {
  background-color: #ecf5ff !important;
}
</style>
