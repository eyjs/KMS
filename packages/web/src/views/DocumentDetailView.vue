<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { relationsApi } from '@/api/relations'
import { placementsApi } from '@/api/placements'
import { useAuthStore } from '@/stores/auth'
import { useDomainStore } from '@/stores/domain'
import { LIFECYCLE_TRANSITIONS, LIFECYCLE_LABELS, FRESHNESS_LABELS, SECURITY_LEVEL_LABELS, RELATION_TYPE_LABELS } from '@kms/shared'
import { useRecentDocs } from '@/composables/useRecentDocs'
import type { DocumentEntity, DocumentPlacementEntity, Lifecycle, RelationEntity, RelationType } from '@kms/shared'
import { ElMessage, ElMessageBox } from 'element-plus'
import PdfViewer from '@/components/viewer/PdfViewer.vue'
import MarkdownViewer from '@/components/viewer/MarkdownViewer.vue'
import CsvViewer from '@/components/viewer/CsvViewer.vue'
import DocumentTimeline from '@/components/document/DocumentTimeline.vue'
import DocumentExplorer from '@/components/document/DocumentExplorer.vue'

const fileInput = ref<HTMLInputElement | null>(null)
const attachLoading = ref(false)

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const domainStore = useDomainStore()

const { addVisit } = useRecentDocs()
const doc = ref<DocumentEntity | null>(null)
const relations = ref<{ asSource: RelationEntity[]; asTarget: RelationEntity[] }>({ asSource: [], asTarget: [] })
const placements = ref<DocumentPlacementEntity[]>([])
const loading = ref(true)

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

function copyDocLink() {
  if (!doc.value) return
  const url = `${window.location.origin}/d/${domainCode.value}/doc/${doc.value.id}`
  navigator.clipboard.writeText(doc.value.docCode ? `${doc.value.docCode} ${url}` : url)
    .then(() => ElMessage.success('문서 링크가 복사되었습니다'))
    .catch(() => ElMessage.error('복사에 실패했습니다'))
}

const hasFile = computed(() => !!doc.value?.downloadUrl)

const backPath = computed(() => {
  if (domainCode.value && domainCode.value !== '_') {
    return `/d/${domainCode.value}`
  }
  return '/'
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
    addVisit(doc.value)

    // 배치 정보 로드
    try {
      const placementRes = await placementsApi.getByDocument(id.value)
      placements.value = placementRes.data
    } catch {
      placements.value = []
    }
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
    const fromLabel = LIFECYCLE_LABELS[doc.value.lifecycle] ?? doc.value.lifecycle
    const toLabel = LIFECYCLE_LABELS[lifecycle] ?? lifecycle
    await ElMessageBox.confirm(
      `${fromLabel} → ${toLabel}(으)로 전환하시겠습니까?`,
      '상태 전환',
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
  const result: Array<{ id: string; type: string; fileName: string; docId: string; direction: 'source' | 'target'; domainCode: string | null }> = []
  for (const r of relations.value.asSource as RelationWithInclude[]) {
    result.push({
      id: r.id,
      type: r.relationType,
      fileName: r.target?.fileName ?? r.targetId,
      docId: r.targetId,
      direction: 'source',
      domainCode: r.domainCode,
    })
  }
  for (const r of relations.value.asTarget as RelationWithInclude[]) {
    result.push({
      id: r.id,
      type: r.relationType,
      fileName: r.source?.fileName ?? r.sourceId,
      docId: r.sourceId,
      direction: 'target',
      domainCode: r.domainCode,
    })
  }
  return result
})

const existingRelationsMap = computed(() => {
  const map = new Map<string, string>()
  for (const rel of allRelations.value) {
    if (!map.has(rel.docId)) {
      map.set(rel.docId, RELATION_TYPE_LABELS[rel.type] ?? rel.type)
    }
  }
  return map
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

const selectedTargetDoc = ref<DocumentEntity | null>(null)

function handleQuickAddSelect(targetDoc: DocumentEntity) {
  selectedTargetDoc.value = targetDoc
  relationForm.value.targetId = targetDoc.id
}

function clearSelectedTarget() {
  selectedTargetDoc.value = null
  relationForm.value.targetId = ''
}

function openRelationDialog() {
  relationForm.value = { relationType: 'REFERENCE', targetId: '' }
  selectedTargetDoc.value = null
  relationDialogVisible.value = true
}

async function handleRelationSubmit() {
  if (!relationForm.value.targetId) {
    ElMessage.warning('대상 문서를 선택하세요')
    return
  }
  relationLoading.value = true
  try {
    // domainCode가 _ 이면 전역 관계, 아니면 도메인 스코프
    const dc = domainCode.value !== '_' ? domainCode.value : undefined
    await relationsApi.create(id.value, relationForm.value.targetId, relationForm.value.relationType, dc)
    ElMessage.success('관계가 추가되었습니다')
    relationDialogVisible.value = false
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
// 문서 정보 수정 (보안등급, 유효기간)
// ============================================================

const editDialogVisible = ref(false)
const editLoading = ref(false)
const editForm = ref<{
  fileName: string
  securityLevel: string
  validUntil: string
}>({
  fileName: '',
  securityLevel: 'INTERNAL',
  validUntil: '',
})

async function openEditDialog() {
  if (!doc.value) return

  // 다중 도메인 참조 경고
  if (doc.value.placementCount > 1) {
    try {
      await ElMessageBox.confirm(
        `이 문서는 ${doc.value.placementCount}개 도메인에서 참조 중입니다. 수정하면 모든 곳에 반영됩니다.`,
        '수정 확인',
        { confirmButtonText: '계속', cancelButtonText: '취소', type: 'warning' },
      )
    } catch {
      return
    }
  }

  editForm.value = {
    fileName: doc.value.fileName ?? '',
    securityLevel: doc.value.securityLevel,
    validUntil: doc.value.validUntil ? doc.value.validUntil.slice(0, 10) : '',
  }
  editDialogVisible.value = true
}

async function handleEditSubmit() {
  if (!doc.value) return
  editLoading.value = true
  try {
    const { data } = await documentsApi.update(id.value, {
      fileName: editForm.value.fileName || undefined,
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

// 배치 삭제
async function handleRemovePlacement(placementId: string, domainName: string) {
  try {
    await ElMessageBox.confirm(
      `"${domainName}" 도메인에서 배치를 해제하시겠습니까? 원본 문서는 유지됩니다.`,
      '배치 해제',
      { type: 'warning' },
    )
    await placementsApi.remove(placementId)
    ElMessage.success('배치가 해제되었습니다')
    const res = await placementsApi.getByDocument(id.value)
    placements.value = res.data
    // placementCount 갱신
    if (doc.value) doc.value.placementCount = placements.value.length
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('배치 해제에 실패했습니다')
  }
}
</script>

<template>
  <div v-loading="loading" style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
    <!-- 상단 네비게이션 -->
    <el-page-header @back="router.push(backPath)" style="flex-shrink: 0; margin-bottom: 12px">
      <template #content>
        <div style="display: flex; align-items: center; gap: 8px">
          <span v-if="doc?.docCode" style="font-family: monospace; font-size: 13px; color: #409eff; margin-right: 2px">
            {{ doc.docCode }}
          </span>
          <el-button
            v-if="doc?.docCode"
            text
            size="small"
            style="padding: 2px 4px; font-size: 12px; color: #909399"
            @click.stop="copyDocLink"
          >
            복사
          </el-button>
          <span style="font-size: 15px">{{ doc?.fileName ?? doc?.id ?? '문서 상세' }}</span>
          <el-tag v-if="doc && doc.placementCount > 1" type="warning" size="small">
            {{ doc.placementCount }}개 도메인 참조
          </el-tag>
        </div>
      </template>
    </el-page-header>

    <div v-if="doc" style="flex: 1; display: flex; gap: 16px; min-height: 0; overflow: hidden">
      <!-- 왼쪽: 메타데이터 -->
      <div style="width: 260px; flex-shrink: 0; overflow-y: auto">
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span style="font-weight: 600">문서 정보</span>
              <el-button
                v-if="auth.hasMinRole('EDITOR')"
                text
                size="small"
                type="primary"
                @click="openEditDialog"
              >
                수정
              </el-button>
            </div>
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
              {{ SECURITY_LEVEL_LABELS[doc.securityLevel] ?? doc.securityLevel }}
            </el-tag>
            <el-tag
              v-if="doc.freshness"
              :type="doc.freshness === 'FRESH' ? 'success' : doc.freshness === 'WARNING' ? 'warning' : 'danger'"
              size="small"
            >
              {{ FRESHNESS_LABELS[doc.freshness] ?? doc.freshness }}
            </el-tag>
          </div>

          <!-- 상세 정보 -->
          <div style="font-size: 13px; color: #606266">
            <p v-if="doc.docCode" style="margin: 8px 0"><strong>문서코드:</strong> <span style="font-family: monospace">{{ doc.docCode }}</span></p>
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

          <!-- 배치 정보 -->
          <el-divider />
          <div style="font-size: 13px">
            <strong style="color: #303133">배치된 도메인</strong>
            <div v-if="placements.length > 0" style="margin-top: 8px">
              <div
                v-for="p in placements"
                :key="p.id"
                style="display: flex; align-items: center; gap: 6px; margin: 6px 0 6px 8px; color: #606266"
              >
                <span
                  style="cursor: pointer; color: #409eff"
                  @click="router.push(`/d/${p.domainCode}`)"
                >
                  {{ p.domainName ?? p.domainCode }}
                </span>
                <span v-if="p.categoryName" style="color: #909399; font-size: 12px">/ {{ p.categoryName }}</span>
                <el-button
                  v-if="auth.hasMinRole('EDITOR')"
                  text
                  size="small"
                  type="danger"
                  style="margin-left: auto; padding: 0"
                  @click="handleRemovePlacement(p.id, p.domainName ?? p.domainCode)"
                >
                  해제
                </el-button>
              </div>
            </div>
            <div v-else style="margin: 8px 0 0 8px; color: #909399">미배치</div>
          </div>

          <!-- 액션 버튼 -->
          <el-divider />
          <div class="action-buttons">
            <!-- 다운로드: 항상 primary -->
            <el-button v-if="hasFile" type="primary" plain @click="handleDownload">
              다운로드
            </el-button>

            <!-- 상태 전환 버튼 그룹 -->
            <div v-if="getNextLifecycles(doc.lifecycle).length > 0" class="action-group">
              <div class="action-group-label">상태 전환</div>
              <el-button
                v-for="next in getNextLifecycles(doc.lifecycle)"
                :key="next"
                :type="next === 'ACTIVE' ? 'success' : next === 'DEPRECATED' ? 'warning' : 'info'"
                plain
                @click="handleTransition(next as Lifecycle)"
              >
                {{ LIFECYCLE_LABELS[next] ?? next }}
              </el-button>
            </div>

            <!-- 삭제: 별도 영역 -->
            <el-button
              v-if="auth.hasMinRole('REVIEWER')"
              type="danger"
              text
              @click="handleDelete"
              style="margin-top: 8px"
            >
              문서 삭제
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
                  v-if="auth.hasMinRole('EDITOR')"
                  type="primary"
                  size="small"
                  @click="router.push(`/d/${domainCode}/compare?source=${id}`)"
                >
                  관계 설정
                </el-button>
                <el-button
                  v-if="auth.hasMinRole('EDITOR')"
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
              <el-tag size="small" type="info">{{ RELATION_TYPE_LABELS[rel.type] ?? rel.type }}</el-tag>
              <el-tag v-if="rel.domainCode" size="small" style="font-size: 11px">{{ rel.domainCode }}</el-tag>
              <span
                style="font-size: 13px; color: #303133; flex: 1; cursor: pointer"
                @click="router.push(`/d/${domainCode}/doc/${rel.docId}`)"
              >
                {{ rel.fileName }}
              </span>
              <el-button
                v-if="auth.hasMinRole('EDITOR')"
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
      width="720px"
      :close-on-click-modal="false"
    >
      <div style="display: flex; gap: 16px; height: 420px">
        <!-- 왼쪽: DocumentExplorer -->
        <div style="flex: 1; min-width: 0; border: 1px solid #ebeef5; border-radius: 4px; overflow: hidden">
          <DocumentExplorer
            v-if="doc"
            :source-document="doc"
            :exclude-id="doc.id"
            :existing-relations="existingRelationsMap"
            @select="handleQuickAddSelect"
          />
        </div>

        <!-- 오른쪽: 선택된 문서 프리뷰 + 관계 유형 -->
        <div style="width: 240px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px">
          <!-- 대상 문서 프리뷰 -->
          <div style="font-size: 13px; font-weight: 600; color: #303133">대상 문서</div>
          <div v-if="selectedTargetDoc" style="border: 1px solid #dcdfe6; border-radius: 4px; padding: 12px">
            <div style="font-size: 13px; font-weight: 500; color: #303133; word-break: break-all">
              {{ selectedTargetDoc.fileName ?? '(제목 없음)' }}
            </div>
            <div v-if="selectedTargetDoc.docCode" style="font-size: 12px; color: #409eff; font-family: monospace; margin-top: 4px">
              {{ selectedTargetDoc.docCode }}
            </div>
            <div style="display: flex; align-items: center; gap: 4px; margin-top: 8px; flex-wrap: wrap">
              <el-tag
                size="small"
                :type="selectedTargetDoc.lifecycle === 'ACTIVE' ? 'success' : selectedTargetDoc.lifecycle === 'DRAFT' ? 'info' : 'danger'"
              >
                {{ LIFECYCLE_LABELS[selectedTargetDoc.lifecycle] ?? selectedTargetDoc.lifecycle }}
              </el-tag>
              <el-tag v-if="selectedTargetDoc.placementCount > 0" size="small">{{ selectedTargetDoc.placementCount }}곳 배치</el-tag>
            </div>
            <el-button
              text
              size="small"
              type="primary"
              style="margin-top: 8px; padding: 0"
              @click="clearSelectedTarget"
            >
              변경
            </el-button>
          </div>
          <div v-else style="border: 1px dashed #dcdfe6; border-radius: 4px; padding: 24px 12px; text-align: center; color: #909399; font-size: 13px">
            왼쪽에서 문서를 선택하세요
          </div>

          <!-- 관계 유형 -->
          <div style="margin-top: auto">
            <div style="font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 8px">관계 유형</div>
            <el-select v-model="relationForm.relationType" style="width: 100%">
              <el-option
                v-for="rt in RELATION_TYPES"
                :key="rt.value"
                :label="rt.label"
                :value="rt.value"
              />
            </el-select>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="relationDialogVisible = false">취소</el-button>
        <el-button type="primary" :loading="relationLoading" :disabled="!relationForm.targetId" @click="handleRelationSubmit">추가</el-button>
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
        <el-form-item label="파일명">
          <el-input v-model="editForm.fileName" placeholder="표시될 파일명" />
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            다운로드 시 사용될 파일명입니다
          </div>
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

<style scoped>
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-buttons .el-button {
  width: 100%;
  margin: 0;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
}

.action-group-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 2px;
}
</style>
