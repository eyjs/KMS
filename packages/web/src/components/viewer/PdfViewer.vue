<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { documentsApi } from '@/api/documents'
import { client } from '@/api/client'

const props = defineProps<{
  documentId: string
  previewUrl?: string
}>()

const objectUrl = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function loadPdf() {
  loading.value = true
  error.value = null
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }
  try {
    if (props.previewUrl) {
      const { data } = await client.get(props.previewUrl, { responseType: 'blob' })
      objectUrl.value = URL.createObjectURL(data as Blob)
    } else {
      const { data } = await documentsApi.previewFile(props.documentId)
      const pdfBlob = new Blob([data], { type: 'application/pdf' })
      objectUrl.value = URL.createObjectURL(pdfBlob)
    }
  } catch {
    error.value = 'PDF 로드에 실패했습니다'
  } finally {
    loading.value = false
  }
}

watch(() => [props.documentId, props.previewUrl], loadPdf)
onMounted(loadPdf)
onUnmounted(() => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
  }
})
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column">
    <div v-if="loading" style="display: flex; align-items: center; justify-content: center; height: 100%">
      <el-icon class="is-loading" :size="24" />
    </div>
    <div v-else-if="error" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #f56c6c">
      {{ error }}
    </div>
    <iframe
      v-else-if="objectUrl"
      :src="objectUrl"
      style="width: 100%; flex: 1; border: none; min-height: 300px"
    />
  </div>
</template>
