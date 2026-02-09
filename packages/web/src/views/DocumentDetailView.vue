<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { relationsApi } from '@/api/relations'
import { useAuthStore } from '@/stores/auth'
import { LIFECYCLE_TRANSITIONS } from '@kms/shared'
import type { DocumentEntity, Lifecycle, RelationEntity } from '@kms/shared'
import { ElMessage, ElMessageBox } from 'element-plus'
import PdfViewer from '@/components/viewer/PdfViewer.vue'
import MarkdownViewer from '@/components/viewer/MarkdownViewer.vue'
import CsvViewer from '@/components/viewer/CsvViewer.vue'
import DocumentTimeline from '@/components/document/DocumentTimeline.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const doc = ref<DocumentEntity | null>(null)
const relations = ref<{ asSource: RelationEntity[]; asTarget: RelationEntity[] }>({ asSource: [], asTarget: [] })
const loading = ref(true)

const SECURITY_LABELS: Record<string, string> = {
  PUBLIC: '공개',
  INTERNAL: '사내용',
  CONFIDENTIAL: '대외비(2급)',
  SECRET: '기밀(1급)',
}

const RELATION_LABELS: Record<string, string> = {
  PARENT_OF: '상위 문서',
  CHILD_OF: '하위 문서',
  SIBLING: '형제 문서',
  REFERENCE: '참조',
  SUPERSEDES: '대체',
}

const id = computed(() => route.params.id as string)
const domainCode = computed(() => route.params.domainCode as string)

const backPath = computed(() => {
  if (domainCode.value && domainCode.value !== '_') {
    return `/d/${domainCode.value}`
  }
  return '/'
})

const breadcrumb = computed(() => {
  if (!doc.value) return ''
  const parts: string[] = []
  if (doc.value.classifications.carrier) parts.push(doc.value.classifications.carrier)
  if (doc.value.classifications.product) parts.push(doc.value.classifications.product)
  if (doc.value.classifications.docType) parts.push(doc.value.classifications.docType)
  return parts.join(' > ')
})

onMounted(async () => {
  try {
    const [docRes, relRes] = await Promise.all([
      documentsApi.get(id.value),
      relationsApi.getByDocument(id.value),
    ])
    doc.value = docRes.data
    relations.value = relRes.data
  } catch {
    ElMessage.error('문서를 불러올 수 없습니다')
    router.push(backPath.value)
  } finally {
    loading.value = false
  }
})

async function handleTransition(lifecycle: Lifecycle) {
  if (!doc.value) return
  try {
    await ElMessageBox.confirm(
      `${doc.value.lifecycle} → ${lifecycle}로 전환하시겠습니까?`,
      '라이프사이클 전환',
    )
    const { data } = await documentsApi.transitionLifecycle(id.value, lifecycle)
    doc.value = data
    ElMessage.success('전환되었습니다')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('전환에 실패했습니다')
  }
}

async function handleDelete() {
  if (!doc.value) return
  try {
    await ElMessageBox.confirm('정말 삭제하시겠습니까?', '문서 삭제', { type: 'warning' })
    await documentsApi.delete(id.value)
    ElMessage.success('삭제되었습니다')
    router.push(backPath.value)
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('삭제에 실패했습니다')
  }
}

async function handleDownload() {
  try {
    const { data } = await documentsApi.downloadFile(id.value)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.value?.fileName ?? 'download'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('다운로드에 실패했습니다')
  }
}

function getNextLifecycles(current: string): string[] {
  return LIFECYCLE_TRANSITIONS[current as Lifecycle] ?? []
}

interface RelationWithInclude extends RelationEntity {
  target?: { fileName?: string }
  source?: { fileName?: string }
}

const allRelations = computed(() => {
  const result: Array<{ id: string; type: string; fileName: string; docId: string; direction: 'source' | 'target' }> = []
  for (const r of relations.value.asSource as RelationWithInclude[]) {
    result.push({
      id: r.id,
      type: r.relationType,
      fileName: r.target?.fileName ?? r.targetId,
      docId: r.targetId,
      direction: 'source',
    })
  }
  for (const r of relations.value.asTarget as RelationWithInclude[]) {
    result.push({
      id: r.id,
      type: r.relationType,
      fileName: r.source?.fileName ?? r.sourceId,
      docId: r.sourceId,
      direction: 'target',
    })
  }
  return result
})
</script>

<template>
  <div v-loading="loading">
    <!-- 상단 네비게이션 -->
    <el-page-header @back="router.push(backPath)">
      <template #content>
        <div style="display: flex; align-items: center; gap: 8px">
          <span v-if="breadcrumb" style="color: #909399; font-size: 13px">
            {{ doc?.domain }} > {{ breadcrumb }} >
          </span>
          <span>{{ doc?.fileName ?? '문서 상세' }}</span>
        </div>
      </template>
    </el-page-header>

    <div v-if="doc" style="display: flex; gap: 20px; margin-top: 20px">
      <!-- 왼쪽: 메타데이터 -->
      <div style="width: 280px; flex-shrink: 0">
        <el-card shadow="never">
          <template #header>
            <span style="font-weight: 600">문서 정보</span>
          </template>

          <!-- 상태 태그 -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px">
            <el-tag :type="doc.lifecycle === 'ACTIVE' ? 'success' : doc.lifecycle === 'DRAFT' ? 'info' : 'danger'" size="small">
              {{ doc.lifecycle }}
            </el-tag>
            <el-tag
              :type="doc.securityLevel === 'SECRET' ? 'danger' : doc.securityLevel === 'CONFIDENTIAL' ? 'warning' : ''"
              size="small"
            >
              {{ SECURITY_LABELS[doc.securityLevel] ?? doc.securityLevel }}
            </el-tag>
            <el-tag
              v-if="doc.freshness"
              :type="doc.freshness === 'FRESH' ? 'success' : doc.freshness === 'WARNING' ? 'warning' : 'danger'"
              size="small"
            >
              {{ doc.freshness }}
            </el-tag>
          </div>

          <!-- 상세 정보 -->
          <div style="font-size: 13px; color: #606266">
            <p style="margin: 8px 0"><strong>버전:</strong> v{{ doc.versionMajor }}.{{ doc.versionMinor }}</p>
            <p style="margin: 8px 0"><strong>형식:</strong> {{ doc.fileType.toUpperCase() }}</p>
            <p style="margin: 8px 0"><strong>크기:</strong> {{ (doc.fileSize / 1024).toFixed(1) }} KB</p>
            <p style="margin: 8px 0"><strong>생성일:</strong> {{ new Date(doc.createdAt).toLocaleString('ko-KR') }}</p>
            <p style="margin: 8px 0"><strong>수정일:</strong> {{ new Date(doc.updatedAt).toLocaleString('ko-KR') }}</p>
          </div>

          <!-- 분류 -->
          <el-divider />
          <div style="font-size: 13px">
            <strong style="color: #303133">분류</strong>
            <div v-for="(value, key) in doc.classifications" :key="key" style="margin: 6px 0 6px 8px; color: #606266">
              <span style="color: #909399">{{ key }}:</span> {{ value }}
            </div>
          </div>

          <!-- 액션 버튼 -->
          <el-divider />
          <div style="display: flex; flex-direction: column; gap: 8px">
            <el-button size="small" @click="handleDownload" style="width: 100%">다운로드</el-button>
            <el-button
              v-for="next in getNextLifecycles(doc.lifecycle)"
              :key="next"
              size="small"
              type="primary"
              @click="handleTransition(next as Lifecycle)"
              style="width: 100%"
            >
              → {{ next }}
            </el-button>
            <el-button
              v-if="auth.hasMinRole('TEAM_LEAD')"
              size="small"
              type="danger"
              @click="handleDelete"
              style="width: 100%"
            >
              삭제
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- 오른쪽: 뷰어 + 이력 + 관계 -->
      <div style="flex: 1; min-width: 0">
        <!-- 문서 뷰어 -->
        <el-card shadow="never" style="margin-bottom: 20px" :body-style="{ padding: '0' }">
          <template #header>
            <span style="font-weight: 600">문서 뷰어</span>
          </template>
          <div style="height: 500px">
            <PdfViewer v-if="doc.fileType === 'pdf'" :document-id="doc.id" />
            <MarkdownViewer v-else-if="doc.fileType === 'md'" :document-id="doc.id" />
            <CsvViewer v-else-if="doc.fileType === 'csv'" :document-id="doc.id" />
          </div>
        </el-card>

        <!-- 변경 이력 -->
        <el-card shadow="never" style="margin-bottom: 20px">
          <template #header>
            <span style="font-weight: 600">변경 이력</span>
          </template>
          <DocumentTimeline :document-id="doc.id" />
        </el-card>

        <!-- 관련 문서 -->
        <el-card shadow="never">
          <template #header>
            <span style="font-weight: 600">관련 문서</span>
          </template>
          <div v-if="allRelations.length > 0">
            <div
              v-for="rel in allRelations"
              :key="rel.id"
              style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f2f3f5; cursor: pointer"
              @click="router.push(`/d/${doc!.domain}/doc/${rel.docId}`)"
            >
              <el-tag size="small" type="info">{{ RELATION_LABELS[rel.type] ?? rel.type }}</el-tag>
              <span style="font-size: 13px; color: #303133">{{ rel.fileName }}</span>
            </div>
          </div>
          <el-empty v-else description="관련 문서가 없습니다" :image-size="60" />
        </el-card>
      </div>
    </div>
  </div>
</template>
