<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { feedbackApi } from '@/api/feedback'
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_TAG_TYPES,
  FEEDBACK_CATEGORY_TAG_TYPES,
  FeedbackStatus,
} from '@kms/shared'
import type { FeedbackEntity, FeedbackStatus as FeedbackStatusType } from '@kms/shared'
import { ElMessage } from 'element-plus'
import { formatDateTimeShort } from '@/utils'

const loading = ref(false)
const feedbacks = ref<FeedbackEntity[]>([])
const filterStatus = ref('')
const filterCategory = ref('')

async function loadFeedbacks() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (filterCategory.value) params.category = filterCategory.value
    const { data } = await feedbackApi.list(params)
    feedbacks.value = data
  } catch {
    ElMessage.error('피드백 목록을 불러올 수 없습니다')
  } finally {
    loading.value = false
  }
}

onMounted(loadFeedbacks)

// 상세 다이얼로그
const detailVisible = ref(false)
const detailLoading = ref(false)
const current = ref<FeedbackEntity | null>(null)
const editStatus = ref<FeedbackStatusType>('OPEN')
const editNote = ref('')

function openDetail(row: FeedbackEntity) {
  current.value = row
  editStatus.value = row.status
  editNote.value = row.adminNote ?? ''
  detailVisible.value = true
}

async function saveDetail() {
  if (!current.value) return
  detailLoading.value = true
  try {
    await feedbackApi.update(current.value.id, {
      status: editStatus.value,
      adminNote: editNote.value,
    })
    ElMessage.success('저장되었습니다')
    detailVisible.value = false
    await loadFeedbacks()
  } catch {
    ElMessage.error('저장에 실패했습니다')
  } finally {
    detailLoading.value = false
  }
}

function formatDate(d: string) {
  return formatDateTimeShort(d)
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-shrink: 0">
      <h2 style="margin: 0; font-size: 18px">피드백 관리</h2>
      <div style="display: flex; gap: 8px">
        <el-select v-model="filterStatus" placeholder="상태" clearable size="small" style="width: 120px" @change="loadFeedbacks">
          <el-option v-for="(label, key) in FEEDBACK_STATUS_LABELS" :key="key" :label="label" :value="key" />
        </el-select>
        <el-select v-model="filterCategory" placeholder="유형" clearable size="small" style="width: 120px" @change="loadFeedbacks">
          <el-option v-for="(label, key) in FEEDBACK_CATEGORY_LABELS" :key="key" :label="label" :value="key" />
        </el-select>
      </div>
    </div>

    <el-table
      :data="feedbacks"
      v-loading="loading"
      size="small"
      :header-cell-style="{ background: '#fafafa' }"
      style="flex: 1; overflow: auto"
      @row-click="openDetail"
      row-class-name="cursor-pointer"
    >
      <el-table-column label="유형" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="(FEEDBACK_CATEGORY_TAG_TYPES[row.category] as any) || 'info'">
            {{ FEEDBACK_CATEGORY_LABELS[row.category] ?? row.category }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="제목" min-width="250" show-overflow-tooltip />
      <el-table-column label="작성자" width="120">
        <template #default="{ row }">{{ row.user?.name ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="상태" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="(FEEDBACK_STATUS_TAG_TYPES[row.status] as any) || ''">
            {{ FEEDBACK_STATUS_LABELS[row.status] ?? row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="접수일" width="160">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <!-- 상세 다이얼로그 -->
    <el-dialog v-model="detailVisible" title="피드백 상세" width="560px">
      <template v-if="current">
        <div style="margin-bottom: 16px">
          <div style="display: flex; gap: 8px; margin-bottom: 8px">
            <el-tag size="small" :type="(FEEDBACK_CATEGORY_TAG_TYPES[current.category] as any) || 'info'">
              {{ FEEDBACK_CATEGORY_LABELS[current.category] ?? current.category }}
            </el-tag>
            <span style="font-size: 12px; color: #909399">{{ current.user?.name }} &middot; {{ formatDate(current.createdAt) }}</span>
          </div>
          <h3 style="margin: 0 0 8px">{{ current.title }}</h3>
          <div style="white-space: pre-wrap; font-size: 13px; color: #303133; background: #f5f7fa; padding: 12px; border-radius: 4px">{{ current.content }}</div>
          <div v-if="current.pageUrl" style="margin-top: 8px; font-size: 12px; color: #909399">
            페이지: {{ current.pageUrl }}
          </div>
        </div>
        <el-divider />
        <el-form label-position="top">
          <el-form-item label="상태">
            <el-select v-model="editStatus" style="width: 160px">
              <el-option v-for="(label, key) in FEEDBACK_STATUS_LABELS" :key="key" :label="label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="관리자 메모">
            <el-input v-model="editNote" type="textarea" :rows="3" placeholder="처리 내용이나 메모를 남겨주세요" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">닫기</el-button>
        <el-button type="primary" :loading="detailLoading" @click="saveDetail">저장</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
:deep(.cursor-pointer) {
  cursor: pointer;
}
</style>
