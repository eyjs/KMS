<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { documentsApi } from '@/api/documents'
import type { DocumentHistoryEntry } from '@/api/documents'
import { ACTION_LABELS, ACTION_TAG_TYPES, RELATION_TYPE_LABELS } from '@kms/shared'

const props = defineProps<{
  documentId: string
}>()

const history = ref<DocumentHistoryEntry[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await documentsApi.getHistory(props.documentId)
    history.value = data
  } catch {
    history.value = []
  } finally {
    loading.value = false
  }
})

function formatChanges(action: string, changes: Record<string, unknown> | null): string {
  if (!changes) return ''

  // 관계 추가/삭제
  if (action === 'RELATION_ADD' || action === 'RELATION_REMOVE') {
    const relLabel = RELATION_TYPE_LABELS[changes.relationType as string] ?? changes.relationType
    const fileName = changes.targetFileName ? ` ${changes.targetFileName}` : ''
    const display = changes.targetDocCode ? `${changes.targetDocCode}${fileName}` : (changes.targetFileName ?? changes.targetId ?? '')
    return `${relLabel} → ${display}`
  }

  // 배치 추가/삭제
  if (action === 'PLACEMENT_ADD' || action === 'PLACEMENT_REMOVE') {
    return changes.domainName ? String(changes.domainName) : String(changes.domainCode ?? '')
  }

  // 상태 변경
  if (changes.from && changes.to) {
    const reason = changes.reason === 'auto_superseded' ? ' (자동 만료)' : ''
    return `${changes.from} → ${changes.to}${reason}`
  }

  // 파일 첨부
  if (changes.fileName) {
    return String(changes.fileName)
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
        :type="ACTION_TAG_TYPES[entry.action] ?? 'info'"
        :timestamp="new Date(entry.createdAt).toLocaleString('ko-KR')"
        placement="top"
      >
        <div style="font-size: 13px">
          <strong>{{ ACTION_LABELS[entry.action] ?? entry.action }}</strong>
          <span v-if="entry.userName" style="color: #909399; margin-left: 8px">
            {{ entry.userName }}
          </span>
        </div>
        <div v-if="formatChanges(entry.action, entry.changes)" style="font-size: 12px; color: #606266; margin-top: 4px">
          {{ formatChanges(entry.action, entry.changes) }}
        </div>
      </el-timeline-item>
    </el-timeline>
    <el-empty v-else-if="!loading" description="변경 이력이 없습니다" :image-size="60" />
  </div>
</template>
