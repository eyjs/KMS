<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { documentsApi } from '@/api/documents'
import type { DocumentHistoryEntry } from '@/api/documents'

const props = defineProps<{
  documentId: string
}>()

const history = ref<DocumentHistoryEntry[]>([])
const loading = ref(false)

const ACTION_LABELS: Record<string, string> = {
  CREATE: '최초 업로드',
  UPDATE: '문서 수정',
  LIFECYCLE_CHANGE: '상태 변경',
  DELETE: '삭제',
}

const ACTION_TYPES: Record<string, string> = {
  CREATE: 'success',
  UPDATE: 'primary',
  LIFECYCLE_CHANGE: 'warning',
  DELETE: 'danger',
}

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await documentsApi.getHistory(props.documentId)
    history.value = data
  } catch {
    // history API가 아직 없을 수 있음
    history.value = []
  } finally {
    loading.value = false
  }
})

function formatChanges(changes: Record<string, unknown> | null): string {
  if (!changes) return ''
  if (changes.from && changes.to) {
    return `${changes.from} → ${changes.to}`
  }
  return ''
}
</script>

<template>
  <div v-loading="loading">
    <el-timeline v-if="history.length > 0">
      <el-timeline-item
        v-for="entry in history"
        :key="entry.id"
        :type="ACTION_TYPES[entry.action] ?? 'info'"
        :timestamp="new Date(entry.createdAt).toLocaleString('ko-KR')"
        placement="top"
      >
        <div style="font-size: 13px">
          <strong>{{ ACTION_LABELS[entry.action] ?? entry.action }}</strong>
          <span v-if="entry.userName" style="color: #909399; margin-left: 8px">
            {{ entry.userName }}
          </span>
        </div>
        <div v-if="formatChanges(entry.changes)" style="font-size: 12px; color: #606266; margin-top: 4px">
          {{ formatChanges(entry.changes) }}
        </div>
      </el-timeline-item>
    </el-timeline>
    <el-empty v-else-if="!loading" description="변경 이력이 없습니다" :image-size="60" />
  </div>
</template>
