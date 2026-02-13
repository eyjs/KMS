<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import type { AuditLogEntry, AuditStats } from '@/api/documents'
import { ACTION_LABELS, ACTION_TAG_TYPES } from '@kms/shared'

const router = useRouter()
const loading = ref(true)
const logLoading = ref(false)

const stats = ref<AuditStats | null>(null)
const logData = ref<AuditLogEntry[]>([])
const logTotal = ref(0)
const logPage = ref(1)
const LOG_PAGE_SIZE = 20

const filterAction = ref('')
const filterDateRange = ref<[string, string] | null>(null)

const ACTION_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'VIEW', label: '열람' },
  { value: 'DOWNLOAD', label: '다운로드' },
  { value: 'CREATE', label: '업로드' },
  { value: 'UPDATE', label: '수정' },
  { value: 'DELETE', label: '삭제' },
  { value: 'LIFECYCLE_CHANGE', label: '상태 변경' },
  { value: 'FILE_ATTACH', label: '파일 첨부' },
  { value: 'FILE_REPLACE', label: '파일 교체' },
]

async function loadLog() {
  logLoading.value = true
  try {
    const params: Record<string, unknown> = { page: logPage.value, size: LOG_PAGE_SIZE }
    if (filterAction.value) params.action = filterAction.value
    if (filterDateRange.value) {
      params.dateFrom = filterDateRange.value[0]
      params.dateTo = filterDateRange.value[1]
    }
    const { data } = await documentsApi.getAuditLog(params as Parameters<typeof documentsApi.getAuditLog>[0])
    logData.value = data.data
    logTotal.value = data.meta.total
  } catch {
    logData.value = []
    logTotal.value = 0
  } finally {
    logLoading.value = false
  }
}

async function handleFilter() {
  logPage.value = 1
  await loadLog()
}

async function handlePageChange(page: number) {
  logPage.value = page
  await loadLog()
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR')
}

function goToDocument(docId: string) {
  router.push(`/d/_/doc/${docId}`)
}

onMounted(async () => {
  try {
    const [statsRes] = await Promise.all([
      documentsApi.getAuditStats(),
      loadLog(),
    ])
    stats.value = statsRes.data
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading" class="audit-view">
    <h2 style="margin: 0 0 16px; font-size: 18px">감사 로그</h2>

    <!-- 통계 카드 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span style="font-weight: 600; font-size: 14px">Top 10 조회 문서</span>
          </template>
          <el-table v-if="stats?.topViewed?.length" :data="stats.topViewed" size="small" :header-cell-style="{ background: '#fafafa' }">
            <el-table-column label="문서" min-width="200">
              <template #default="{ row }">
                <span
                  style="cursor: pointer; color: #409eff"
                  @click="goToDocument(row.documentId)"
                >
                  {{ row.fileName ?? row.docCode ?? row.documentId.slice(0, 8) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="조회수" width="80" align="center">
              <template #default="{ row }">
                <strong>{{ row.viewCount }}</strong>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="조회 기록이 없습니다" :image-size="40" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span style="font-weight: 600; font-size: 14px">사용자별 활동</span>
          </template>
          <el-table v-if="stats?.userActivity?.length" :data="stats.userActivity" size="small" :header-cell-style="{ background: '#fafafa' }">
            <el-table-column prop="userName" label="사용자" min-width="150" />
            <el-table-column label="활동 수" width="80" align="center">
              <template #default="{ row }">
                <strong>{{ row.actionCount }}</strong>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="활동 기록이 없습니다" :image-size="40" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 필터 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
        <el-select v-model="filterAction" placeholder="액션 유형" style="width: 160px" clearable>
          <el-option
            v-for="opt in ACTION_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-date-picker
          v-model="filterDateRange"
          type="daterange"
          range-separator="~"
          start-placeholder="시작일"
          end-placeholder="종료일"
          value-format="YYYY-MM-DD"
          style="width: 300px"
          clearable
        />
        <el-button type="primary" @click="handleFilter">검색</el-button>
      </div>
    </el-card>

    <!-- 로그 테이블 -->
    <el-card shadow="never">
      <el-table v-loading="logLoading" :data="logData" size="small" :header-cell-style="{ background: '#fafafa' }">
        <el-table-column label="시간" width="160">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="사용자" width="100">
          <template #default="{ row }">
            {{ row.userName ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column label="액션" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="ACTION_TAG_TYPES[row.action] ?? 'info'">
              {{ ACTION_LABELS[row.action] ?? row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="문서" min-width="200">
          <template #default="{ row }">
            <span
              style="cursor: pointer; color: #409eff"
              @click="goToDocument(row.documentId)"
            >
              {{ row.fileName ?? row.docCode ?? row.documentId.slice(0, 8) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="logTotal > LOG_PAGE_SIZE" style="margin-top: 12px; text-align: right">
        <el-pagination
          layout="prev, pager, next"
          :total="logTotal"
          :page-size="LOG_PAGE_SIZE"
          :current-page="logPage"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.audit-view {
  height: 100%;
  overflow-y: auto;
}
.audit-view :deep(.el-card__header) {
  padding: 10px 16px;
}
.audit-view :deep(.el-card__body) {
  padding: 12px 16px;
}
</style>
