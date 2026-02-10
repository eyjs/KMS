<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { relationsApi } from '@/api/relations'
import { taxonomyApi } from '@/api/taxonomy'
import { useAuthStore } from '@/stores/auth'
import { useDomainStore } from '@/stores/domain'
import { LIFECYCLE_TRANSITIONS, FACET_TYPE_LABELS, LIFECYCLE_LABELS } from '@kms/shared'
import type { DocumentEntity, Lifecycle, RelationEntity, RelationType, FacetMasterEntity } from '@kms/shared'
import { ElMessage, ElMessageBox } from 'element-plus'
import PdfViewer from '@/components/viewer/PdfViewer.vue'
import MarkdownViewer from '@/components/viewer/MarkdownViewer.vue'
import CsvViewer from '@/components/viewer/CsvViewer.vue'
import DocumentTimeline from '@/components/document/DocumentTimeline.vue'

const fileInput = ref<HTMLInputElement | null>(null)
const attachLoading = ref(false)

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const domainStore = useDomainStore()

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

const RELATION_TYPES: Array<{ value: RelationType; label: string }> = [
  { value: 'PARENT_OF', label: '상위 문서 (PARENT_OF)' },
  { value: 'CHILD_OF', label: '하위 문서 (CHILD_OF)' },
  { value: 'SIBLING', label: '형제 문서 (SIBLING)' },
  { value: 'REFERENCE', label: '참조 (REFERENCE)' },
  { value: 'SUPERSEDES', label: '대체 (SUPERSEDES)' },
]

const SECURITY_OPTIONS = [
  { value: 'PUBLIC', label: '공개 (PUBLIC)' },
  { value: 'INTERNAL', label: '사내용 (INTERNAL)' },
  { value: 'CONFIDENTIAL', label: '대외비 (CONFIDENTIAL)' },
  { value: 'SECRET', label: '기밀 (SECRET)' },
]

const id = computed(() => route.params.id as string)
const domainCode = computed(() => route.params.domainCode as string)

function facetLabel(facetType: string): string {
  return FACET_TYPE_LABELS[facetType] ?? facetType
}

const hasFile = computed(() => !!doc.value?.downloadUrl)

const backPath = computed(() => {
  if (domainCode.value && domainCode.value !== '_') {
    return `/d/${domainCode.value}`
  }
  return '/'
})

const breadcrumb = computed(() => {
  if (!doc.value) return ''
  return Object.values(doc.value.classifications).join(' > ')
})

onMounted(async () => {
  try {
    const [docRes, relRes] = await Promise.all([
      documentsApi.get(id.value),
      relationsApi.getByDocument(id.value),
      domainStore.loadDomains(),
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

function triggerFileAttach() {
  fileInput.value?.click()
}

async function handleFileAttach(event: Event) {
  const input = event.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f || !doc.value) return

  const ext = f.name.split('.').pop()?.toLowerCase()
  if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
    ElMessage.error('PDF, Markdown, CSV 파일만 허용됩니다')
    return
  }

  attachLoading.value = true
  try {
    const { data } = await documentsApi.attachFile(doc.value.id, f)
    doc.value = data
    ElMessage.success('파일이 첨부되었습니다')
  } catch {
    ElMessage.error('파일 첨부에 실패했습니다')
  } finally {
    attachLoading.value = false
    input.value = ''
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

// ============================================================
// 관계 추가/삭제
// ============================================================

const relationDialogVisible = ref(false)
const relationForm = ref<{ relationType: RelationType; targetId: string }>({
  relationType: 'REFERENCE',
  targetId: '',
})
const relationLoading = ref(false)

// 대상 문서 검색 (remote select, debounce 적용)
const searchResults = ref<DocumentEntity[]>([])
const searchLoading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function handleDocumentSearch(query: string) {
  if (searchTimer) clearTimeout(searchTimer)
  if (!query || query.length < 1) {
    searchResults.value = []
    return
  }
  searchLoading.value = true
  searchTimer = setTimeout(async () => {
    try {
      const { data } = await documentsApi.search({ q: query, size: 20 })
      // 현재 문서 제외
      searchResults.value = data.data.filter((d: DocumentEntity) => d.id !== id.value)
    } catch {
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

function openRelationDialog() {
  relationForm.value = { relationType: 'REFERENCE', targetId: '' }
  searchResults.value = []
  relationDialogVisible.value = true
}

async function handleRelationSubmit() {
  if (!relationForm.value.targetId) {
    ElMessage.warning('대상 문서를 선택하세요')
    return
  }
  relationLoading.value = true
  try {
    await relationsApi.create(id.value, relationForm.value.targetId, relationForm.value.relationType)
    ElMessage.success('관계가 추가되었습니다')
    relationDialogVisible.value = false
    // 관계 새로고침
    const { data } = await relationsApi.getByDocument(id.value)
    relations.value = data
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '관계 추가에 실패했습니다'
    ElMessage.error(msg)
  } finally {
    relationLoading.value = false
  }
}

async function handleRelationDelete(relationId: string) {
  try {
    await ElMessageBox.confirm('이 관계를 삭제하시겠습니까?', '관계 삭제', { type: 'warning' })
    await relationsApi.delete(relationId)
    ElMessage.success('관계가 삭제되었습니다')
    const { data } = await relationsApi.getByDocument(id.value)
    relations.value = data
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('관계 삭제에 실패했습니다')
  }
}

// ============================================================
// 문서 분류/보안등급 수정
// ============================================================

const editDialogVisible = ref(false)
const editLoading = ref(false)
const editForm = ref<{
  classifications: Record<string, string>
  securityLevel: string
  validUntil: string
}>({
  classifications: {},
  securityLevel: 'INTERNAL',
  validUntil: '',
})
const facetOptions = ref<Record<string, FacetMasterEntity[]>>({})

async function openEditDialog() {
  if (!doc.value) return

  // 현재 값으로 폼 초기화
  editForm.value = {
    classifications: { ...doc.value.classifications },
    securityLevel: doc.value.securityLevel,
    validUntil: doc.value.validUntil ? doc.value.validUntil.slice(0, 10) : '',
  }

  // 도메인의 requiredFacets 가져와서 각 facet 옵션 로드
  const domain = domainStore.domainsFlat.find((d) => d.code === doc.value!.domain)
  if (domain) {
    const requiredFacets = (domain.requiredFacets ?? []) as string[]
    const loadPromises = requiredFacets
      .map(async (ft) => {
        const { data } = await taxonomyApi.getFacets(ft, domain.code)
        facetOptions.value[`${domain.code}:${ft}`] = data
      })
    await Promise.all(loadPromises)
  }

  editDialogVisible.value = true
}

function getEditFacetOptions(facetType: string): FacetMasterEntity[] {
  if (!doc.value) return []
  return (facetOptions.value[`${doc.value.domain}:${facetType}`] ?? []).filter((f) => f.isActive)
}

const editRequiredFacets = computed<string[]>(() => {
  if (!doc.value) return []
  const domain = domainStore.domainsFlat.find((d) => d.code === doc.value!.domain)
  return (domain?.requiredFacets ?? []) as string[]
})

async function handleEditSubmit() {
  if (!doc.value) return
  editLoading.value = true
  try {
    const { data } = await documentsApi.update(id.value, {
      classifications: editForm.value.classifications,
      securityLevel: editForm.value.securityLevel,
      validUntil: editForm.value.validUntil || null,
      rowVersion: doc.value.rowVersion,
    })
    doc.value = data
    editDialogVisible.value = false
    ElMessage.success('수정되었습니다')
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '수정에 실패했습니다'
    ElMessage.error(msg)
  } finally {
    editLoading.value = false
  }
}
</script>

<template>
  <div v-loading="loading" style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
    <!-- 상단 네비게이션 -->
    <el-page-header @back="router.push(backPath)" style="flex-shrink: 0; margin-bottom: 12px">
      <template #content>
        <div style="display: flex; align-items: center; gap: 8px">
          <span v-if="breadcrumb" style="color: #909399; font-size: 12px">
            {{ doc?.domain }} > {{ breadcrumb }} >
          </span>
          <span style="font-size: 15px">{{ doc?.fileName ?? doc?.id ?? '문서 상세' }}</span>
        </div>
      </template>
    </el-page-header>

    <div v-if="doc" style="flex: 1; display: flex; gap: 16px; min-height: 0; overflow: hidden">
      <!-- 왼쪽: 메타데이터 -->
      <div style="width: 260px; flex-shrink: 0; overflow-y: auto">
        <el-card shadow="never">
          <template #header>
            <span style="font-weight: 600">문서 정보</span>
          </template>

          <!-- 상태 태그 -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px">
            <el-tag :type="doc.lifecycle === 'ACTIVE' ? 'success' : doc.lifecycle === 'DRAFT' ? 'info' : 'danger'" size="small">
              {{ LIFECYCLE_LABELS[doc.lifecycle] ?? doc.lifecycle }}
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
            <p style="margin: 8px 0"><strong>형식:</strong> {{ doc.fileType?.toUpperCase() ?? '-' }}</p>
            <p style="margin: 8px 0"><strong>크기:</strong> {{ hasFile ? (doc.fileSize / 1024).toFixed(1) + ' KB' : '-' }}</p>
            <p style="margin: 8px 0"><strong>생성일:</strong> {{ new Date(doc.createdAt).toLocaleString('ko-KR') }}</p>
            <p style="margin: 8px 0"><strong>수정일:</strong> {{ new Date(doc.updatedAt).toLocaleString('ko-KR') }}</p>
            <p style="margin: 8px 0">
              <strong>유효기간:</strong>
              {{ doc.validUntil ? new Date(doc.validUntil).toLocaleDateString('ko-KR') : '미설정' }}
            </p>
          </div>

          <!-- 분류 -->
          <el-divider />
          <div style="font-size: 13px">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
              <strong style="color: #303133">분류</strong>
              <el-button
                v-if="auth.hasMinRole('EMPLOYEE')"
                text
                size="small"
                type="primary"
                @click="openEditDialog"
              >
                수정
              </el-button>
            </div>
            <div v-for="(value, key) in doc.classifications" :key="key" style="margin: 6px 0 6px 8px; color: #606266">
              <span style="color: #909399">{{ facetLabel(String(key)) }}:</span> {{ value }}
            </div>
          </div>

          <!-- 액션 버튼 -->
          <el-divider />
          <div style="display: flex; flex-direction: column; gap: 8px">
            <el-button v-if="hasFile" size="small" @click="handleDownload" style="width: 100%">다운로드</el-button>
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
      <div style="flex: 1; min-width: 0; overflow-y: auto">
        <!-- 문서 뷰어 -->
        <el-card shadow="never" style="margin-bottom: 12px" :body-style="{ padding: '0' }">
          <template #header>
            <span style="font-weight: 600">문서 뷰어</span>
          </template>
          <div v-if="hasFile" style="height: 400px">
            <PdfViewer v-if="doc.fileType === 'pdf'" :document-id="doc.id" />
            <MarkdownViewer v-else-if="doc.fileType === 'md'" :document-id="doc.id" />
            <CsvViewer v-else-if="doc.fileType === 'csv'" :document-id="doc.id" />
          </div>
          <div v-else style="padding: 40px; text-align: center; color: #909399">
            <p style="margin: 0 0 12px">파일이 아직 첨부되지 않은 문서입니다</p>
            <el-button type="primary" size="small" :loading="attachLoading" @click="triggerFileAttach">
              파일 첨부
            </el-button>
            <input ref="fileInput" type="file" accept=".pdf,.md,.csv" style="display: none" @change="handleFileAttach" />
          </div>
        </el-card>

        <!-- 변경 이력 -->
        <el-card shadow="never" style="margin-bottom: 12px">
          <template #header>
            <span style="font-weight: 600">변경 이력</span>
          </template>
          <DocumentTimeline :document-id="doc.id" />
        </el-card>

        <!-- 관련 문서 -->
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span style="font-weight: 600">관련 문서</span>
              <div style="display: flex; gap: 6px">
                <el-button
                  v-if="auth.hasMinRole('EMPLOYEE')"
                  type="primary"
                  size="small"
                  @click="router.push(`/d/${domainCode}/compare?source=${id}`)"
                >
                  관계 설정
                </el-button>
                <el-button
                  v-if="auth.hasMinRole('EMPLOYEE')"
                  size="small"
                  @click="openRelationDialog"
                >
                  + 빠른 추가
                </el-button>
              </div>
            </div>
          </template>
          <div v-if="allRelations.length > 0">
            <div
              v-for="rel in allRelations"
              :key="rel.id"
              style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f2f3f5"
            >
              <el-tag size="small" type="info">{{ RELATION_LABELS[rel.type] ?? rel.type }}</el-tag>
              <span
                style="font-size: 13px; color: #303133; flex: 1; cursor: pointer"
                @click="router.push(`/d/${doc!.domain}/doc/${rel.docId}`)"
              >
                {{ rel.fileName }}
              </span>
              <el-button
                v-if="auth.hasMinRole('EMPLOYEE')"
                text
                size="small"
                type="danger"
                @click="handleRelationDelete(rel.id)"
              >
                삭제
              </el-button>
            </div>
          </div>
          <el-empty v-else description="관련 문서가 없습니다" :image-size="60" />
        </el-card>
      </div>
    </div>

    <!-- 관계 추가 다이얼로그 -->
    <el-dialog
      v-model="relationDialogVisible"
      title="관계 추가"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px" label-position="left">
        <el-form-item label="관계 유형" required>
          <el-select v-model="relationForm.relationType" style="width: 100%">
            <el-option
              v-for="rt in RELATION_TYPES"
              :key="rt.value"
              :label="rt.label"
              :value="rt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="대상 문서" required>
          <el-select
            v-model="relationForm.targetId"
            filterable
            remote
            :remote-method="handleDocumentSearch"
            :loading="searchLoading"
            placeholder="문서 이름으로 검색..."
            style="width: 100%"
          >
            <el-option
              v-for="d in searchResults"
              :key="d.id"
              :label="`${d.fileName ?? d.id} (${d.domain})`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="relationDialogVisible = false">취소</el-button>
        <el-button type="primary" :loading="relationLoading" @click="handleRelationSubmit">추가</el-button>
      </template>
    </el-dialog>

    <!-- 문서 정보 수정 다이얼로그 -->
    <el-dialog
      v-model="editDialogVisible"
      title="문서 정보 수정"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px" label-position="left">
        <el-form-item
          v-for="facetType in editRequiredFacets"
          :key="facetType"
          :label="facetLabel(facetType)"
          required
        >
          <el-select
            v-model="editForm.classifications[facetType]"
            placeholder="선택..."
            style="width: 100%"
          >
            <el-option
              v-for="opt in getEditFacetOptions(facetType)"
              :key="opt.code"
              :label="opt.displayName"
              :value="opt.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="보안등급">
          <el-select
            v-model="editForm.securityLevel"
            style="width: 100%"
            :disabled="!auth.hasMinRole('ADMIN')"
          >
            <el-option
              v-for="opt in SECURITY_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <div v-if="!auth.hasMinRole('ADMIN')" style="font-size: 12px; color: #909399; margin-top: 4px">
            보안등급 변경은 ADMIN만 가능합니다
          </div>
        </el-form-item>
        <el-form-item label="유효기간">
          <el-date-picker
            v-model="editForm.validUntil"
            type="date"
            placeholder="선택사항"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">취소</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleEditSubmit">저장</el-button>
      </template>
    </el-dialog>
  </div>
</template>
