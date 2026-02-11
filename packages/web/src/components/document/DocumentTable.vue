<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { LIFECYCLE_LABELS, FRESHNESS_LABELS } from '@kms/shared'
import type { DocumentEntity, DocumentListQuery } from '@kms/shared'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Connection } from '@element-plus/icons-vue'

const router = useRouter()

const props = defineProps<{
  domainCode: string
  filters?: Record<string, string>
}>()

const emit = defineEmits<{
  select: [doc: DocumentEntity]
  dblclick: [doc: DocumentEntity]
  action: [command: string, doc: DocumentEntity]
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

// 멀티셀렉트
const selectedRows = ref<DocumentEntity[]>([])
const bulkLoading = ref(false)

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

// 선택된 문서들로부터 가능한 벌크 액션 계산
const bulkActions = computed(() => {
  if (selectedRows.value.length === 0) return []
  const actions: Array<{ lifecycle: string; label: string; type: string }> = []
  // 전체가 같은 상태여야 벌크 전환 가능
  const lifecycles = new Set(selectedRows.value.map((d) => d.lifecycle))
  if (lifecycles.size === 1) {
    const current = [...lifecycles][0]
    if (current === 'DRAFT') actions.push({ lifecycle: 'ACTIVE', label: '사용중으로 전환', type: 'success' })
    if (current === 'ACTIVE') {
      actions.push({ lifecycle: 'DRAFT', label: '임시저장으로 전환', type: 'info' })
      actions.push({ lifecycle: 'DEPRECATED', label: '만료 처리', type: 'danger' })
    }
  }
  return actions
})

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
    selectedRows.value = []
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

function handleSelectionChange(rows: DocumentEntity[]) {
  selectedRows.value = rows
}

async function handleBulkTransition(lifecycle: string) {
  const count = selectedRows.value.length
  const label = LIFECYCLE_LABELS[lifecycle] ?? lifecycle
  try {
    await ElMessageBox.confirm(
      `선택한 ${count}건의 문서를 "${label}" 상태로 전환합니다.`,
      '일괄 상태 전환',
      { confirmButtonText: '전환', cancelButtonText: '취소', type: 'warning' },
    )
  } catch {
    return
  }

  bulkLoading.value = true
  try {
    const ids = selectedRows.value.map((d) => d.id)
    const { data } = await documentsApi.bulkTransitionLifecycle(ids, lifecycle)
    if (data.failed > 0) {
      ElMessage.warning(`${data.succeeded}건 성공, ${data.failed}건 실패`)
    } else {
      ElMessage.success(`${data.succeeded}건 전환 완료`)
    }
    await fetchDocuments()
  } catch {
    ElMessage.error('일괄 전환에 실패했습니다')
  } finally {
    bulkLoading.value = false
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
        <el-option label="임시저장" value="DRAFT" />
        <el-option label="사용중" value="ACTIVE" />
        <el-option label="만료" value="DEPRECATED" />
      </el-select>

      <!-- 벌크 액션 -->
      <template v-if="selectedRows.length > 0">
        <el-divider direction="vertical" />
        <span style="font-size: 12px; color: #409eff; font-weight: 500">
          {{ selectedRows.length }}건 선택
        </span>
        <el-button
          v-for="action in bulkActions"
          :key="action.lifecycle"
          :type="action.type as 'success' | 'info' | 'danger'"
          size="small"
          plain
          :loading="bulkLoading"
          @click="handleBulkTransition(action.lifecycle)"
        >
          {{ action.label }}
        </el-button>
      </template>

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
      @selection-change="handleSelectionChange"
      :row-class-name="getRowClassName"
      style="cursor: pointer"
      :header-cell-style="{ background: '#fafafa', color: '#606266' }"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column label="문서코드" width="150" prop="docCode" show-overflow-tooltip>
        <template #default="{ row }">
          <span
            v-if="row.docCode"
            style="font-family: monospace; font-size: 12px; color: #409eff; cursor: pointer"
            @click.stop="router.push(`/d/${row.domain}/doc/${row.id}`)"
          >{{ row.docCode }}</span>
          <span v-else style="color: #c0c4cc">-</span>
        </template>
      </el-table-column>
      <el-table-column label="파일명" min-width="200" sortable="custom" prop="fileName" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.fileName ?? '(메타데이터만)' }}</span>
          <el-tooltip v-if="row.relationCount > 0" :content="`관계 ${row.relationCount}건`" placement="top">
            <el-icon style="margin-left: 4px; color: #409eff; vertical-align: middle"><Connection /></el-icon>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="상태" width="90">
        <template #default="{ row }">
          <el-tag :type="LIFECYCLE_TAG[row.lifecycle] ?? 'info'" size="small">
            {{ LIFECYCLE_LABELS[row.lifecycle] ?? row.lifecycle }}
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
      <el-table-column label="갱신상태" width="90">
        <template #default="{ row }">
          <el-tag
            v-if="row.freshness"
            :type="row.freshness === 'FRESH' ? 'success' : row.freshness === 'WARNING' ? 'warning' : 'danger'"
            size="small"
          >
            {{ FRESHNESS_LABELS[row.freshness] ?? row.freshness }}
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
      <el-table-column width="50" align="center">
        <template #default="{ row }">
          <el-dropdown trigger="click" @command="(cmd: string) => emit('action', cmd, row)" @click.stop>
            <el-button text size="small" style="padding: 2px" @click.stop>...</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="detail">상세보기</el-dropdown-item>
                <el-dropdown-item command="compare">관계설정</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
