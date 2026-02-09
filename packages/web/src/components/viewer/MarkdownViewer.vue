<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { documentsApi } from '@/api/documents'

const props = defineProps<{
  documentId: string
}>()

const content = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const renderedHtml = computed(() => {
  if (!content.value) return ''
  const raw = marked(content.value) as string
  return DOMPurify.sanitize(raw)
})

async function loadMarkdown() {
  loading.value = true
  error.value = null
  try {
    const { data } = await documentsApi.downloadFile(props.documentId)
    content.value = await (data as Blob).text()
  } catch {
    error.value = 'Markdown 로드에 실패했습니다'
  } finally {
    loading.value = false
  }
}

watch(() => props.documentId, loadMarkdown)
onMounted(loadMarkdown)
</script>

<template>
  <div style="padding: 16px; height: 100%; overflow: auto">
    <div v-if="loading" style="display: flex; align-items: center; justify-content: center; height: 200px">
      <el-icon class="is-loading" :size="24" />
    </div>
    <div v-else-if="error" style="color: #f56c6c">{{ error }}</div>
    <div v-else class="markdown-body" v-html="renderedHtml" />
  </div>
</template>

<style scoped>
.markdown-body {
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
}
.markdown-body :deep(h1) { font-size: 20px; margin: 16px 0 8px; }
.markdown-body :deep(h2) { font-size: 17px; margin: 14px 0 6px; }
.markdown-body :deep(h3) { font-size: 15px; margin: 12px 0 4px; }
.markdown-body :deep(p) { margin: 8px 0; }
.markdown-body :deep(code) { background: #f5f7fa; padding: 2px 4px; border-radius: 3px; font-size: 13px; }
.markdown-body :deep(pre) { background: #f5f7fa; padding: 12px; border-radius: 4px; overflow-x: auto; }
.markdown-body :deep(table) { border-collapse: collapse; width: 100%; }
.markdown-body :deep(th), .markdown-body :deep(td) { border: 1px solid #dcdfe6; padding: 6px 10px; text-align: left; }
.markdown-body :deep(th) { background: #fafafa; font-weight: 600; }
</style>
