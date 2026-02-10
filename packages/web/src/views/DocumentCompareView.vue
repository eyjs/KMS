<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { relationsApi } from '@/api/relations'
import { FACET_TYPE_LABELS } from '@kms/shared'
import type { DocumentEntity, RelationType } from '@kms/shared'
import { ElMessage } from 'element-plus'
import PdfViewer from '@/components/viewer/PdfViewer.vue'
import MarkdownViewer from '@/components/viewer/MarkdownViewer.vue'
import CsvViewer from '@/components/viewer/CsvViewer.vue'

const route = useRoute()
const router = useRouter()

const domainCode = computed(() => route.params.domainCode as string)
const sourceId = computed(() => route.query.source as string | undefined)

const sourceDoc = ref<DocumentEntity | null>(null)
const targetDoc = ref<DocumentEntity | null>(null)
const loading = ref(false)
const saving = ref(false)

// 관계 유형
const relationType = ref<RelationType>('REFERENCE')
const RELATION_OPTIONS: Array<{ value: RelationType; label: string }> = [
  { value: 'PARENT_OF', label: '상위' },
  { value: 'CHILD_OF', label: '하위' },
  { value: 'SIBLING', label: '형제' },
  { value: 'REFERENCE', label: '참조' },
  { value: 'SUPERSEDES', label: '대체' },
]

// 대상 문서 검색
const searchQuery = ref('')
const searchResults = ref<DocumentEntity[]>([])
const searchLoading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const SECURITY_LABELS: Record<string, string> = {
  PUBLIC: '공개',
  INTERNAL: '사내용',
  CONFIDENTIAL: '대외비(2급)',
  SECRET: '기밀(1급)',
}

function facetLabel(key: string): string {
  return FACET_TYPE_LABELS[key] ?? key
}

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

onMounted(async () => {
  if (sourceId.value) {
    loading.value = true
    try {
      const { data } = await documentsApi.get(sourceId.value)
      sourceDoc.value = data
    } catch {
      ElMessage.error('출발 문서를 불러올 수 없습니다')
    } finally {
      loading.value = false
    }
  }
})

function handleSearch(query: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchQuery.value = query
  if (!query || query.length < 1) {
    searchResults.value = []
    return
  }
  searchLoading.value = true
  searchTimer = setTimeout(async () => {
    try {
      const { data } = await documentsApi.search({ q: query, size: 20 })
      // 출발 문서 제외
      searchResults.value = data.data.filter((d: DocumentEntity) => d.id !== sourceId.value)
    } catch {
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

async function selectTarget(doc: DocumentEntity) {
  targetDoc.value = doc
  searchResults.value = []
  searchQuery.value = ''
}

async function handleSave() {
  if (!sourceDoc.value || !targetDoc.value) {
    ElMessage.warning('출발 문서와 대상 문서를 모두 선택하세요')
    return
  }

  saving.value = true
  try {
    await relationsApi.create(sourceDoc.value.id, targetDoc.value.id, relationType.value)
    ElMessage.success('관계가 설정되었습니다')
    router.push(`/d/${domainCode.value}/doc/${sourceDoc.value.id}`)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '관계 설정에 실패했습니다'
    ElMessage.error(msg)
  } finally {
    saving.value = false
  }
}

function goBack() {
  if (sourceDoc.value) {
    router.push(`/d/${domainCode.value}/doc/${sourceDoc.value.id}`)
  } else {
    router.push(`/d/${domainCode.value}`)
  }
}
</script>

<template>
  <div v-loading="loading" style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
    <!-- 상단 헤더 -->
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-shrink: 0">
      <el-button text @click="goBack">
        &lt; 뒤로
      </el-button>
      <span style="font-size: 16px; font-weight: 600">문서 비교 및 관계 설정</span>
    </div>

    <!-- 비교 패널 -->
    <div style="flex: 1; display: flex; gap: 12px; min-height: 0; overflow: hidden">
      <!-- 왼쪽: 출발 문서 -->
      <div style="flex: 1; display: flex; flex-direction: column; min-width: 0">
        <el-card shadow="never" style="flex: 1; display: flex; flex-direction: column" :body-style="{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }">
          <template #header>
            <span style="font-weight: 600">출발 문서</span>
          </template>

          <template v-if="sourceDoc">
            <!-- 뷰어 -->
            <div v-if="sourceDoc.downloadUrl" style="flex: 1; min-height: 200px; overflow: auto; border-bottom: 1px solid #ebeef5">
              <PdfViewer v-if="sourceDoc.fileType === 'pdf'" :document-id="sourceDoc.id" />
              <MarkdownViewer v-else-if="sourceDoc.fileType === 'md'" :document-id="sourceDoc.id" />
              <CsvViewer v-else-if="sourceDoc.fileType === 'csv'" :document-id="sourceDoc.id" />
            </div>
            <div v-else style="flex: 1; display: flex; align-items: center; justify-content: center; color: #909399; border-bottom: 1px solid #ebeef5">
              파일이 첨부되지 않은 문서입니다
            </div>

            <!-- 메타데이터 -->
            <div style="padding: 12px; font-size: 13px">
              <p style="margin: 4px 0; font-weight: 600; color: #303133">{{ sourceDoc.fileName ?? '(제목 없음)' }}</p>
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0">
                <el-tag size="small" :type="sourceDoc.lifecycle === 'ACTIVE' ? 'success' : sourceDoc.lifecycle === 'DRAFT' ? 'info' : 'danger'">
                  {{ sourceDoc.lifecycle }}
                </el-tag>
                <el-tag size="small">{{ SECURITY_LABELS[sourceDoc.securityLevel] ?? sourceDoc.securityLevel }}</el-tag>
                <el-tag v-if="sourceDoc.freshness" size="small" :type="sourceDoc.freshness === 'FRESH' ? 'success' : sourceDoc.freshness === 'WARNING' ? 'warning' : 'danger'">
                  {{ sourceDoc.freshness }}
                </el-tag>
              </div>
              <p style="margin: 4px 0; color: #606266">도메인: {{ sourceDoc.domain }}</p>
              <p v-if="sourceDoc.validUntil" style="margin: 4px 0; color: #606266">
                유효기간: {{ new Date(sourceDoc.validUntil).toLocaleDateString('ko-KR') }}
              </p>
              <div v-if="Object.keys(sourceDoc.classifications).length > 0" style="margin-top: 4px; color: #606266">
                <span v-for="(value, key) in sourceDoc.classifications" :key="key" style="margin-right: 12px">
                  {{ facetLabel(String(key)) }}: {{ value }}
                </span>
              </div>
            </div>
          </template>

          <div v-else style="flex: 1; display: flex; align-items: center; justify-content: center; color: #909399">
            출발 문서가 선택되지 않았습니다
          </div>
        </el-card>
      </div>

      <!-- 오른쪽: 대상 문서 -->
      <div style="flex: 1; display: flex; flex-direction: column; min-width: 0">
        <el-card shadow="never" style="flex: 1; display: flex; flex-direction: column" :body-style="{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }">
          <template #header>
            <span style="font-weight: 600">대상 문서</span>
          </template>

          <!-- 검색 -->
          <div style="padding: 12px; border-bottom: 1px solid #ebeef5">
            <el-input
              v-model="searchQuery"
              placeholder="문서 이름으로 검색..."
              clearable
              @input="handleSearch"
            >
              <template #prefix>
                <span style="color: #909399">🔍</span>
              </template>
            </el-input>
          </div>

          <!-- 검색 결과 (대상 미선택 시) -->
          <div v-if="!targetDoc && searchResults.length > 0" style="flex: 1; overflow: auto; padding: 0">
            <div
              v-for="result in searchResults"
              :key="result.id"
              style="padding: 10px 12px; border-bottom: 1px solid #f2f3f5; cursor: pointer; transition: background 0.15s"
              @mouseenter="($event.currentTarget as HTMLElement).style.background = '#f5f7fa'"
              @mouseleave="($event.currentTarget as HTMLElement).style.background = ''"
              @click="selectTarget(result)"
            >
              <div style="font-size: 13px; font-weight: 500; color: #303133">
                {{ result.fileName ?? '(제목 없음)' }}
              </div>
              <div style="font-size: 12px; color: #909399; margin-top: 2px">
                {{ result.domain }}
                <span v-for="(value, key) in result.classifications" :key="key" style="margin-left: 8px">
                  {{ facetLabel(String(key)) }}: {{ value }}
                </span>
              </div>
            </div>
          </div>

          <!-- 선택된 대상 문서 -->
          <template v-if="targetDoc">
            <div v-if="targetDoc.downloadUrl" style="flex: 1; min-height: 200px; overflow: auto; border-bottom: 1px solid #ebeef5">
              <PdfViewer v-if="targetDoc.fileType === 'pdf'" :document-id="targetDoc.id" />
              <MarkdownViewer v-else-if="targetDoc.fileType === 'md'" :document-id="targetDoc.id" />
              <CsvViewer v-else-if="targetDoc.fileType === 'csv'" :document-id="targetDoc.id" />
            </div>
            <div v-else style="flex: 1; display: flex; align-items: center; justify-content: center; color: #909399; border-bottom: 1px solid #ebeef5">
              파일이 첨부되지 않은 문서입니다
            </div>

            <div style="padding: 12px; font-size: 13px">
              <div style="display: flex; justify-content: space-between; align-items: center">
                <p style="margin: 4px 0; font-weight: 600; color: #303133">{{ targetDoc.fileName ?? '(제목 없음)' }}</p>
                <el-button text size="small" type="primary" @click="targetDoc = null">변경</el-button>
              </div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0">
                <el-tag size="small" :type="targetDoc.lifecycle === 'ACTIVE' ? 'success' : targetDoc.lifecycle === 'DRAFT' ? 'info' : 'danger'">
                  {{ targetDoc.lifecycle }}
                </el-tag>
                <el-tag size="small">{{ SECURITY_LABELS[targetDoc.securityLevel] ?? targetDoc.securityLevel }}</el-tag>
                <el-tag v-if="targetDoc.freshness" size="small" :type="targetDoc.freshness === 'FRESH' ? 'success' : targetDoc.freshness === 'WARNING' ? 'warning' : 'danger'">
                  {{ targetDoc.freshness }}
                </el-tag>
              </div>
              <p style="margin: 4px 0; color: #606266">도메인: {{ targetDoc.domain }}</p>
              <p v-if="targetDoc.validUntil" style="margin: 4px 0; color: #606266">
                유효기간: {{ new Date(targetDoc.validUntil).toLocaleDateString('ko-KR') }}
              </p>
              <div v-if="Object.keys(targetDoc.classifications).length > 0" style="margin-top: 4px; color: #606266">
                <span v-for="(value, key) in targetDoc.classifications" :key="key" style="margin-right: 12px">
                  {{ facetLabel(String(key)) }}: {{ value }}
                </span>
              </div>
            </div>
          </template>

          <!-- 대상 미선택 & 검색 결과 없음 -->
          <div v-if="!targetDoc && searchResults.length === 0" style="flex: 1; display: flex; align-items: center; justify-content: center; color: #909399">
            문서를 검색하여 비교할 대상을 선택하세요
          </div>
        </el-card>
      </div>
    </div>

    <!-- 하단: 관계 설정 -->
    <el-card shadow="never" style="margin-top: 8px; flex-shrink: 0" :body-style="{ padding: '10px 16px' }">
      <div style="display: flex; align-items: center; gap: 16px">
        <span style="font-size: 14px; font-weight: 600; color: #303133; white-space: nowrap">관계 유형:</span>
        <el-radio-group v-model="relationType">
          <el-radio-button v-for="opt in RELATION_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
        <div style="flex: 1" />
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!sourceDoc || !targetDoc"
          @click="handleSave"
        >
          저장
        </el-button>
      </div>
    </el-card>
  </div>
</template>
