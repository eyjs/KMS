<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi, type DocumentStats } from '@/api/documents'
import BulkPlacementDialog from '@/components/document/BulkPlacementDialog.vue'
import UploadDialog from '@/components/domain/UploadDialog.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import { LIFECYCLE_LABELS, SECURITY_LEVEL_LABELS } from '@kms/shared'
import { ElMessage } from 'element-plus'
import type { DocumentEntity, Lifecycle } from '@kms/shared'

const router = useRouter()

// 상태
const loading = ref(false)
const documents = ref<DocumentEntity[]>([])
const total = ref(0)
const stats = ref<DocumentStats | null>(null)

// 필터
const keyword = ref('')
const lifecycleFilter = ref<Lifecycle | ''>('')
const orphanOnly = ref(false)
const page = ref(1)
const pageSize = ref(20)
const sortField = ref('updatedAt')
const sortOrder = ref<'asc' | 'desc'>('desc')

// 선택
const selectedIds = ref<string[]>([])
const bulkPlacementVisible = ref(false)
const selectingAll = ref(false)

// 업로드
const uploadVisible = ref(false)

// 통계 카드
const statCards = computed(() => {
  if (!stats.value) return []
  return [
    { key: 'total', label: '전체', value: stats.value.total, filter: null },
    { key: 'active', label: '사용중', value: stats.value.active, filter: 'ACTIVE' },
    { key: 'draft', label: '임시저장', value: stats.value.draft, filter: 'DRAFT' },
    { key: 'orphan', label: '미배치', value: stats.value.orphan, filter: 'orphan' },
  ]
})

const activeStatKey = computed(() => {
  if (orphanOnly.value) return 'orphan'
  if (lifecycleFilter.value) return lifecycleFilter.value.toLowerCase()
  return 'total'
})

// 데이터 로드
async function loadStats() {
  try {
    const res = await documentsApi.getStats()
    stats.value = res.data
  } catch {
    // 통계 로드 실패 시 기본값 유지
  }
}

async function loadDocuments() {
  loading.value = true
  try {
    const res = await documentsApi.list({
      page: page.value,
      size: pageSize.value,
      sort: sortField.value,
      order: sortOrder.value,
      lifecycle: lifecycleFilter.value || undefined,
      orphan: orphanOnly.value || undefined,
    })
    documents.value = res.data.data
    total.value = res.data.meta.total
  } catch (e) {
    ElMessage.error('문서 목록 로드에 실패했습니다')
  } finally {
    loading.value = false
  }
}

function handleStatClick(key: string) {
  if (key === 'orphan') {
    orphanOnly.value = true
    lifecycleFilter.value = ''
  } else if (key === 'total') {
    orphanOnly.value = false
    lifecycleFilter.value = ''
  } else {
    orphanOnly.value = false
    lifecycleFilter.value = key.toUpperCase() as Lifecycle
  }
  page.value = 1
  loadDocuments()
}

function handleSearch() {
  page.value = 1
  if (keyword.value.trim()) {
    // 검색 페이지로 이동
    router.push({ path: '/search', query: { q: keyword.value } })
  } else {
    loadDocuments()
  }
}

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  sortField.value = prop || 'updatedAt'
  sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  loadDocuments()
}

function handlePageChange(newPage: number) {
  page.value = newPage
  loadDocuments()
}

function handleSizeChange(newSize: number) {
  pageSize.value = newSize
  page.value = 1
  loadDocuments()
}

function handleSelectionChange(rows: DocumentEntity[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function openBulkPlacement() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('문서를 선택해 주세요')
    return
  }
  bulkPlacementVisible.value = true
}

function handleBulkPlacementSuccess() {
  selectedIds.value = []
  loadDocuments()
  loadStats()
}

function handleUploadSuccess() {
  uploadVisible.value = false
  loadDocuments()
  loadStats()
}

// 미배치 문서 전체 선택 (대량 작업용)
async function selectAllOrphans() {
  selectingAll.value = true
  try {
    // 미배치 문서 ID 전체 조회 (최대 5000개)
    const res = await documentsApi.list({
      page: 1,
      size: 5000,
      orphan: true,
    })
    selectedIds.value = res.data.data.map((d) => d.id)
    ElMessage.success(`${selectedIds.value.length.toLocaleString()}건 선택됨`)
  } catch {
    ElMessage.error('전체 선택 실패')
  } finally {
    selectingAll.value = false
  }
}

function goToDocument(row: DocumentEntity) {
  // 배치된 도메인이 있으면 첫 번째 도메인으로, 없으면 _ (고아 문서)
  const firstPlacement = row.placements?.[0]
  const domainCode = firstPlacement?.domainCode ?? '_'
  router.push(`/d/${domainCode}/doc/${row.id}`)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

function getPlacementTags(doc: DocumentEntity): Array<{ code: string; name: string }> {
  if (!doc.placements || doc.placements.length === 0) {
    return []
  }
  return doc.placements.map((p) => ({
    code: p.domainCode,
    name: p.domainName ?? p.domainCode,
  }))
}

// 필터 변경 시 자동 로드
watch([lifecycleFilter, orphanOnly], () => {
  page.value = 1
  loadDocuments()
})

onMounted(() => {
  loadStats()
  loadDocuments()
})
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; gap: 16px; overflow: hidden">
    <!-- 헤더 -->
    <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0">
      <h2 style="margin: 0; font-size: 20px">전체 문서함</h2>
      <div style="display: flex; gap: 8px">
        <el-button @click="loadDocuments" :loading="loading">
          <el-icon><component is="Refresh" /></el-icon>
          새로고침
        </el-button>
        <el-button type="primary" @click="uploadVisible = true">
          <el-icon><component is="Upload" /></el-icon>
          업로드
        </el-button>
      </div>
    </div>

    <!-- 통계 카드 -->
    <div style="display: flex; gap: 12px; flex-shrink: 0">
      <div
        v-for="card in statCards"
        :key="card.key"
        class="stat-card"
        :class="{ active: activeStatKey === card.key }"
        @click="handleStatClick(card.key)"
      >
        <div class="stat-value">{{ card.value.toLocaleString() }}</div>
        <div class="stat-label">{{ card.label }}</div>
      </div>
    </div>

    <!-- 필터 바 -->
    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex-shrink: 0">
      <el-input
        v-model="keyword"
        placeholder="문서 검색..."
        prefix-icon="Search"
        clearable
        style="width: 240px"
        @keyup.enter="handleSearch"
        @clear="loadDocuments"
      />
      <el-select v-model="lifecycleFilter" placeholder="상태" clearable style="width: 120px">
        <el-option
          v-for="(label, key) in LIFECYCLE_LABELS"
          :key="key"
          :label="label"
          :value="key"
        />
      </el-select>
      <el-checkbox v-model="orphanOnly">미배치만</el-checkbox>

      <div style="flex: 1" />

      <span v-if="selectedIds.length > 0" style="color: #606266; font-size: 13px">
        {{ selectedIds.length }}건 선택
      </span>
      <el-button
        v-if="selectedIds.length > 0"
        type="primary"
        @click="openBulkPlacement"
      >
        일괄 배치
      </el-button>
    </div>

    <!-- 전체 선택 안내 (미배치 대량 선택 지원) -->
    <el-alert
      v-if="selectedIds.length > 0 && stats && stats.orphan > selectedIds.length"
      type="info"
      :closable="false"
      style="flex-shrink: 0"
    >
      <template #default>
        현재 {{ selectedIds.length.toLocaleString() }}건 선택됨.
        <el-button type="primary" link @click="selectAllOrphans" :loading="selectingAll">
          미배치 문서 전체 선택 ({{ stats.orphan.toLocaleString() }}건)
        </el-button>
      </template>
    </el-alert>

    <!-- 테이블 -->
    <div style="flex: 1; min-height: 0; overflow: hidden">
      <el-table
        :data="documents"
        v-loading="loading"
        style="height: 100%"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
        @row-click="goToDocument"
        row-class-name="clickable-row"
      >
        <el-table-column type="selection" width="45" />
        <el-table-column prop="docCode" label="코드" width="120" sortable="custom">
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 12px">{{ row.docCode ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="fileName" label="파일명" min-width="200" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px">
              <el-icon v-if="row.fileType === 'pdf'" style="color: #e74c3c"><component is="Document" /></el-icon>
              <el-icon v-else-if="row.fileType === 'md'" style="color: #3498db"><component is="Memo" /></el-icon>
              <el-icon v-else style="color: #95a5a6"><component is="Document" /></el-icon>
              <span>{{ row.fileName ?? '(파일 없음)' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="lifecycle" label="상태" width="100" sortable="custom">
          <template #default="{ row }">
            <status-tag type="lifecycle" :value="row.lifecycle" />
          </template>
        </el-table-column>
        <el-table-column label="배치" width="200">
          <template #default="{ row }">
            <div v-if="getPlacementTags(row).length > 0" style="display: flex; flex-wrap: wrap; gap: 4px">
              <el-tag
                v-for="tag in getPlacementTags(row).slice(0, 2)"
                :key="tag.code"
                size="small"
                type="info"
              >
                {{ tag.name }}
              </el-tag>
              <el-tag v-if="getPlacementTags(row).length > 2" size="small" type="info">
                +{{ getPlacementTags(row).length - 2 }}
              </el-tag>
            </div>
            <span v-else style="color: #e6a23c; font-size: 12px">미배치</span>
          </template>
        </el-table-column>
        <el-table-column prop="fileSize" label="크기" width="90" align="right">
          <template #default="{ row }">
            <span style="font-size: 12px; color: #909399">{{ formatFileSize(row.fileSize) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="수정일" width="110" sortable="custom">
          <template #default="{ row }">
            <span style="font-size: 12px; color: #909399">{{ formatDate(row.updatedAt) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 페이지네이션 -->
    <div style="display: flex; justify-content: center; flex-shrink: 0">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 일괄 배치 다이얼로그 -->
    <bulk-placement-dialog
      v-model:visible="bulkPlacementVisible"
      :document-ids="selectedIds"
      @success="handleBulkPlacementSuccess"
    />

    <!-- 업로드 다이얼로그 -->
    <upload-dialog
      v-model:visible="uploadVisible"
      @uploaded="handleUploadSuccess"
    />
  </div>
</template>

<style scoped>
.stat-card {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}
.stat-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.stat-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

:deep(.clickable-row) {
  cursor: pointer;
}
:deep(.clickable-row:hover) {
  background-color: #f5f7fa;
}
</style>
