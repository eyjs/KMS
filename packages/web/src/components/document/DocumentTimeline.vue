<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { documentsApi } from '@/api/documents'
import type { DocumentHistoryEntry } from '@/api/documents'
import { FACET_TYPE_LABELS } from '@kms/shared'

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
  FILE_ATTACH: '파일 첨부',
  RELATION_ADD: '관계 추가',
  RELATION_REMOVE: '관계 삭제',
}

const ACTION_TYPES: Record<string, string> = {
  CREATE: 'success',
  UPDATE: 'primary',
  LIFECYCLE_CHANGE: 'warning',
  DELETE: 'danger',
  FILE_ATTACH: 'primary',
  RELATION_ADD: 'success',
  RELATION_REMOVE: 'danger',
}

const RELATION_TYPE_LABELS: Record<string, string> = {
  PARENT_OF: '상위',
  CHILD_OF: '하위',
  SIBLING: '형제',
  REFERENCE: '참조',
  SUPERSEDES: '대체',
}

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

  // 관계 추가/삭제: "참조 → COMM-2602-003 수수료체계.pdf"
  if (action === 'RELATION_ADD' || action === 'RELATION_REMOVE') {
    const relLabel = RELATION_TYPE_LABELS[changes.relationType as string] ?? changes.relationType
    const fileName = changes.targetFileName ? ` ${changes.targetFileName}` : ''
    const display = changes.targetDocCode ? `${changes.targetDocCode}${fileName}` : (changes.targetFileName ?? changes.targetId ?? '')
    return `${relLabel} → ${display}`
  }

  // 상태 변경
  if (changes.from && changes.to) {
    const reason = changes.reason === 'auto_superseded' ? ' (자동 만료)' : ''
    return `${changes.from} → ${changes.to}${reason}`
  }

  // 분류 변경
  if (changes.classifications && typeof changes.classifications === 'object') {
    const cls = changes.classifications as Record<string, string>
    return Object.entries(cls)
      .map(([k, v]) => `${FACET_TYPE_LABELS[k] ?? k}: ${v}`)
      .join(', ')
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
        <div v-if="formatChanges(entry.action, entry.changes)" style="font-size: 12px; color: #606266; margin-top: 4px">
          {{ formatChanges(entry.action, entry.changes) }}
        </div>
      </el-timeline-item>
    </el-timeline>
    <el-empty v-else-if="!loading" description="변경 이력이 없습니다" :image-size="60" />
  </div>
</template>
