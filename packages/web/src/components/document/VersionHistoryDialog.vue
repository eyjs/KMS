<script setup lang="ts">
import { ref, watch } from 'vue'
import { documentsApi } from '@/api/documents'
import type { DocumentVersionEntity } from '@kms/shared'
import { ElMessage } from 'element-plus'
import PdfViewer from '@/components/viewer/PdfViewer.vue'
import MarkdownViewer from '@/components/viewer/MarkdownViewer.vue'
import CsvViewer from '@/components/viewer/CsvViewer.vue'

const props = defineProps<{
  visible: boolean
  documentId: string
  currentVersion: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const versions = ref<DocumentVersionEntity[]>([])
const loading = ref(false)

const previewVisible = ref(false)
const previewVersion = ref<DocumentVersionEntity | null>(null)
const previewUrl = ref('')

async function loadVersions() {
  if (!props.documentId) return
  loading.value = true
  try {
    const { data } = await documentsApi.getVersions(props.documentId)
    versions.value = data
  } catch {
    versions.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (v) => {
  if (v) loadVersions()
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function handlePreview(version: DocumentVersionEntity) {
  previewVersion.value = version
  previewUrl.value = documentsApi.getVersionPreviewUrl(props.documentId, version.id)
  previewVisible.value = true
}

async function handleDownload(version: DocumentVersionEntity) {
  try {
    const { data } = await documentsApi.downloadVersionFile(props.documentId, version.id)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = version.fileName
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('다운로드에 실패했습니다')
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="버전 이력"
    width="700px"
    @update:model-value="handleClose"
  >
    <div v-loading="loading">
      <div style="margin-bottom: 12px; font-size: 13px; color: #909399">
        현재 버전: <strong style="color: #303133">{{ currentVersion }}</strong>
      </div>

      <el-table v-if="versions.length > 0" :data="versions" size="small" :header-cell-style="{ background: '#fafafa' }">
        <el-table-column label="버전" width="90" align="center">
          <template #default="{ row }">
            <span style="font-family: monospace">v{{ row.versionMajor }}.{{ row.versionMinor }}</span>
          </template>
        </el-table-column>
        <el-table-column label="파일명" min-width="180">
          <template #default="{ row }">
            <span style="word-break: break-all">{{ row.fileName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="크기" width="90" align="right">
          <template #default="{ row }">
            {{ formatSize(row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column label="업로더" width="90">
          <template #default="{ row }">
            {{ row.uploadedByName ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column label="시간" width="150">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString('ko-KR') }}
          </template>
        </el-table-column>
        <el-table-column label="" width="130" align="center">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="handlePreview(row)">미리보기</el-button>
            <el-button size="small" text @click="handleDownload(row)">다운로드</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else-if="!loading" description="이전 버전이 없습니다" :image-size="60" />
    </div>
  </el-dialog>

  <!-- 버전 미리보기 서브 다이얼로그 -->
  <el-dialog
    v-model="previewVisible"
    :title="`미리보기 — v${previewVersion?.versionMajor}.${previewVersion?.versionMinor} ${previewVersion?.fileName ?? ''}`"
    width="80%"
    top="5vh"
    destroy-on-close
  >
    <div style="height: 70vh">
      <PdfViewer
        v-if="previewVersion?.fileType === 'pdf'"
        :document-id="documentId"
        :preview-url="previewUrl"
      />
      <MarkdownViewer
        v-else-if="previewVersion?.fileType === 'md'"
        :document-id="documentId"
        :preview-url="previewUrl"
      />
      <CsvViewer
        v-else-if="previewVersion?.fileType === 'csv'"
        :document-id="documentId"
        :preview-url="previewUrl"
      />
    </div>
  </el-dialog>
</template>
