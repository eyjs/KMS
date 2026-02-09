<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { documentsApi } from '@/api/documents'

const props = defineProps<{
  documentId: string
}>()

const rawContent = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const parsedData = computed(() => {
  if (!rawContent.value) return { headers: [], rows: [] }

  const lines = rawContent.value.trim().split('\n')
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map(parseCsvLine)

  return { headers, rows }
})

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

async function loadCsv() {
  loading.value = true
  error.value = null
  try {
    const { data } = await documentsApi.downloadFile(props.documentId)
    rawContent.value = await (data as Blob).text()
  } catch {
    error.value = 'CSV 로드에 실패했습니다'
  } finally {
    loading.value = false
  }
}

watch(() => props.documentId, loadCsv)
onMounted(loadCsv)
</script>

<template>
  <div style="padding: 12px; height: 100%; overflow: auto">
    <div v-if="loading" style="display: flex; align-items: center; justify-content: center; height: 200px">
      <el-icon class="is-loading" :size="24" />
    </div>
    <div v-else-if="error" style="color: #f56c6c">{{ error }}</div>
    <el-table
      v-else-if="parsedData.rows.length > 0"
      :data="parsedData.rows.map((row, i) => ({ _index: i, ...Object.fromEntries(parsedData.headers.map((h, j) => [h || `col_${j}`, row[j] ?? ''])) }))"
      size="small"
      :header-cell-style="{ background: '#fafafa' }"
      max-height="400"
    >
      <el-table-column
        v-for="(header, idx) in parsedData.headers"
        :key="idx"
        :prop="header || `col_${idx}`"
        :label="header || `컬럼 ${idx + 1}`"
        min-width="100"
        show-overflow-tooltip
      />
    </el-table>
    <el-empty v-else description="데이터가 없습니다" :image-size="60" />
  </div>
</template>
