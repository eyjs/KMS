<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDomainStore } from '@/stores/domain'
import { useAuthStore } from '@/stores/auth'
import { taxonomyApi } from '@/api/taxonomy'
import ClassificationTree from '@/components/domain/ClassificationTree.vue'
import DocumentTable from '@/components/document/DocumentTable.vue'
import DocumentPreview from '@/components/document/DocumentPreview.vue'
import UploadDialog from '@/components/domain/UploadDialog.vue'
import RelationGraph from '@/components/graph/RelationGraph.vue'
import { relationsApi } from '@/api/relations'
import { DOMAIN_MAX_DEPTH, DOMAIN_LEVEL_LABELS, DOMAIN_GUIDANCE } from '@kms/shared'
import type { DocumentEntity, DomainMasterEntity, CreateDomainDto, UpdateDomainDto, RelationGraphResponse } from '@kms/shared'

const route = useRoute()
const router = useRouter()
const domainStore = useDomainStore()
const auth = useAuthStore()

const domainCode = computed(() => route.params.domainCode as string)
const filters = ref<Record<string, string>>({})
const selectedDoc = ref<DocumentEntity | null>(null)
const showPreview = ref(true)
const showUpload = ref(false)
const activeTab = ref<'list' | 'graph'>('list')
const docTableRef = ref<InstanceType<typeof DocumentTable>>()

// 그래프 데이터
const graphData = ref<RelationGraphResponse | null>(null)
const graphLoading = ref(false)

// 하위 도메인
const childDomains = computed(() =>
  domainStore.domainsFlat.filter((d) => d.parentCode === domainCode.value),
)
const isAdmin = computed(() => auth.hasMinRole('ADMIN'))

// 도메인 경로 (루트 → 현재까지의 체인)
const domainBreadcrumb = computed(() => {
  const path: DomainMasterEntity[] = []
  let current = domainStore.domainsFlat.find((d) => d.code === domainCode.value)
  while (current) {
    path.unshift(current)
    current = current.parentCode
      ? domainStore.domainsFlat.find((d) => d.code === current!.parentCode)
      : undefined
  }
  return path
})

watch(domainCode, (code) => {
  if (code) {
    domainStore.setCurrentDomain(code)
    filters.value = {}
    selectedDoc.value = null
  }
}, { immediate: true })

async function loadDomainGraph() {
  graphLoading.value = true
  try {
    const { data } = await relationsApi.getDomainGraph(domainCode.value)
    graphData.value = data
  } catch {
    graphData.value = null
  } finally {
    graphLoading.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'graph') loadDomainGraph()
})

function handleGraphNodeClick(nodeId: string) {
  router.push(`/d/${domainCode.value}/doc/${nodeId}`)
}

function handleTreeSelect(treeFilters: Record<string, string>) {
  filters.value = treeFilters
  selectedDoc.value = null
}

function handleDocSelect(doc: DocumentEntity) {
  selectedDoc.value = doc
  showPreview.value = true
}

function handleDocDblClick(doc: DocumentEntity) {
  router.push(`/d/${domainCode.value}/doc/${doc.id}`)
}

function handleDocAction(command: string, doc: DocumentEntity) {
  if (command === 'detail') {
    router.push(`/d/${domainCode.value}/doc/${doc.id}`)
  } else if (command === 'compare') {
    router.push(`/d/${domainCode.value}/compare?source=${doc.id}`)
  }
}

function handleUploadSuccess() {
  showUpload.value = false
  docTableRef.value?.refresh()
}

function openUpload() {
  showUpload.value = true
}

function navigateToChild(child: DomainMasterEntity) {
  router.push(`/d/${child.code}`)
}

// 도메인 깊이 계산
function getDomainDepth(code: string): number {
  let depth = 0
  let current = domainStore.domainsFlat.find((d) => d.code === code)
  while (current?.parentCode) {
    depth++
    current = domainStore.domainsFlat.find((d) => d.code === current!.parentCode)
  }
  return depth
}

const canAddChildDomain = computed(() =>
  getDomainDepth(domainCode.value) + 1 < DOMAIN_MAX_DEPTH,
)

// 하위 도메인 CRUD
const childDialogVisible = ref(false)
const childDialogMode = ref<'create' | 'edit'>('create')
const childDialogLoading = ref(false)
const childFormData = ref({
  codeSuffix: '',
  displayName: '',
  description: '',
  sortOrder: 0,
})
const editingChildCode = ref('')

function openChildCreateDialog() {
  if (!canAddChildDomain.value) {
    const maxLabel = DOMAIN_LEVEL_LABELS[DOMAIN_MAX_DEPTH - 1] ?? '최하위'
    ElMessage.warning(`도메인은 "${maxLabel}" 단계까지 가능합니다. ${DOMAIN_GUIDANCE.facetGuide}`)
    return
  }
  childDialogMode.value = 'create'
  childFormData.value = { codeSuffix: '', displayName: '', description: '', sortOrder: 0 }
  childDialogVisible.value = true
}

function openChildEditDialog(child: DomainMasterEntity) {
  childDialogMode.value = 'edit'
  editingChildCode.value = child.code
  // 수정 시 접두어 제거하여 suffix만 표시
  const prefix = `${domainCode.value}-`
  childFormData.value = {
    codeSuffix: child.code.startsWith(prefix) ? child.code.slice(prefix.length) : child.code,
    displayName: child.displayName,
    description: child.description ?? '',
    sortOrder: child.sortOrder,
  }
  childDialogVisible.value = true
}

async function handleChildSubmit() {
  if (!childFormData.value.displayName.trim()) {
    ElMessage.warning('이름을 입력하세요')
    return
  }
  childDialogLoading.value = true
  try {
    if (childDialogMode.value === 'create') {
      const dto: CreateDomainDto = {
        displayName: childFormData.value.displayName,
        parentCode: domainCode.value,
        description: childFormData.value.description || undefined,
        sortOrder: childFormData.value.sortOrder,
      }
      // 별칭(코드)을 입력한 경우에만 전달
      if (childFormData.value.codeSuffix.trim()) {
        dto.code = `${domainCode.value}-${childFormData.value.codeSuffix.trim()}`
      }
      await taxonomyApi.createDomain(dto)
      ElMessage.success('하위 도메인이 생성되었습니다')
    } else {
      const dto: UpdateDomainDto = {
        displayName: childFormData.value.displayName,
        description: childFormData.value.description || undefined,
        sortOrder: childFormData.value.sortOrder,
      }
      await taxonomyApi.updateDomain(editingChildCode.value, dto)
      ElMessage.success('하위 도메인이 수정되었습니다')
    }
    childDialogVisible.value = false
    await domainStore.reloadDomains()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류가 발생했습니다'
    ElMessage.error(msg)
  } finally {
    childDialogLoading.value = false
  }
}

// 패널 리사이즈
const treeWidth = ref(220)
const previewWidth = ref(300)
const isResizing = ref(false)
let resizeCleanup: (() => void) | null = null

function startResize(panel: 'tree' | 'preview', e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startWidth = panel === 'tree' ? treeWidth.value : previewWidth.value

  function onMouseMove(ev: MouseEvent) {
    const delta = ev.clientX - startX
    if (panel === 'tree') {
      treeWidth.value = Math.max(180, Math.min(400, startWidth + delta))
    } else {
      previewWidth.value = Math.max(200, Math.min(500, startWidth - delta))
    }
  }

  function onMouseUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    resizeCleanup = null
  }

  resizeCleanup = onMouseUp
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

onUnmounted(() => {
  resizeCleanup?.()
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

async function handleChildDelete(child: DomainMasterEntity) {
  try {
    await ElMessageBox.confirm(
      `"${child.displayName}" 도메인을 삭제하시겠습니까?`,
      '하위 도메인 삭제',
      { confirmButtonText: '삭제', cancelButtonText: '취소', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await taxonomyApi.deleteDomain(child.code)
    ElMessage.success('하위 도메인이 삭제되었습니다')
    await domainStore.reloadDomains()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '삭제 중 오류가 발생했습니다'
    ElMessage.error(msg)
  }
}
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
    <!-- 상단 도구모음 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-shrink: 0">
      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden">
        <!-- 도메인 경로 (인라인) -->
        <template v-if="domainBreadcrumb.length > 1">
          <template v-for="(ancestor, idx) in domainBreadcrumb.slice(0, -1)" :key="ancestor.code">
            <span v-if="idx > 0" style="color: #c0c4cc; font-size: 12px">/</span>
            <span
              style="font-size: 12px; color: #409eff; cursor: pointer; white-space: nowrap"
              @click="router.push(`/d/${ancestor.code}`)"
            >
              {{ ancestor.displayName }}
            </span>
          </template>
          <span style="color: #c0c4cc; font-size: 12px">/</span>
        </template>
        <h2 style="margin: 0; font-size: 18px; white-space: nowrap">
          {{ domainStore.currentDomain?.displayName ?? domainCode }}
        </h2>
        <el-tag size="small">{{ domainCode }}</el-tag>
        <span
          v-if="domainStore.currentDomain?.description"
          style="font-size: 12px; color: #909399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
        >
          {{ domainStore.currentDomain.description }}
        </span>
      </div>
      <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0">
        <el-tooltip v-if="isAdmin && !canAddChildDomain" :content="`업무프로세스 단계까지 도달. ${DOMAIN_GUIDANCE.facetGuide}`" placement="top">
          <el-button size="small" disabled>+ 추가</el-button>
        </el-tooltip>
        <el-button v-else-if="isAdmin" size="small" @click="openChildCreateDialog">+ 추가</el-button>
        <el-button type="primary" size="small" @click="openUpload">
          업로드
        </el-button>
        <el-radio-group v-model="activeTab" size="small">
          <el-radio-button value="list">목록</el-radio-button>
          <el-radio-button value="graph">그래프</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 하위 카테고리 섹션 (자식이 있을 때만 표시) -->
    <div v-if="childDomains.length > 0" style="margin-bottom: 6px; flex-shrink: 0">
      <div style="display: flex; gap: 8px; flex-wrap: wrap; max-height: 80px; overflow-y: auto">
        <div
          v-for="child in childDomains"
          :key="child.code"
          class="child-domain-card"
          @click="navigateToChild(child)"
        >
          <div style="font-size: 13px; font-weight: 500; color: #303133">
            {{ child.displayName }}
          </div>
          <div style="font-size: 11px; color: #909399; margin-top: 1px">
            {{ child.code }}
          </div>
          <!-- ADMIN 드롭다운 -->
          <el-dropdown
            v-if="isAdmin"
            trigger="click"
            style="position: absolute; top: 4px; right: 4px"
            @click.stop
          >
            <el-button text size="small" style="padding: 2px" @click.stop>
              ...
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openChildEditDialog(child)">수정</el-dropdown-item>
                <el-dropdown-item @click="handleChildDelete(child)" style="color: #f56c6c">삭제</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <!-- 3-패널 레이아웃 -->
    <div :class="{ 'is-resizing': isResizing }" style="flex: 1; display: flex; min-height: 0; overflow: hidden">
      <!-- 왼쪽: 분류 트리 -->
      <el-card
        shadow="never"
        :body-style="{ padding: '0', height: '100%', overflow: 'hidden' }"
        :style="{ width: treeWidth + 'px', flexShrink: 0 }"
      >
        <ClassificationTree
          :domain-code="domainCode"
          @select="handleTreeSelect"
        />
      </el-card>

      <!-- 리사이즈 핸들: 트리 ↔ 목록 -->
      <div class="resize-handle" @mousedown="startResize('tree', $event)" />

      <!-- 중앙: 문서 목록 or 그래프 -->
      <div style="flex: 1; min-width: 0">
        <el-card
          shadow="never"
          :body-style="{ padding: '12px', height: '100%', overflow: 'auto' }"
          style="height: 100%"
        >
          <template v-if="activeTab === 'list'">
            <DocumentTable
              ref="docTableRef"
              :domain-code="domainCode"
              :filters="filters"
              @select="handleDocSelect"
              @dblclick="handleDocDblClick"
              @action="handleDocAction"
            />
          </template>
          <template v-else>
            <div style="height: 100%; display: flex; flex-direction: column">
              <div style="display: flex; justify-content: flex-end; padding-bottom: 8px; flex-shrink: 0">
                <el-button size="small" :loading="graphLoading" @click="loadDomainGraph">새로고침</el-button>
              </div>
              <div style="flex: 1; min-height: 0">
                <RelationGraph
                  v-if="graphData && graphData.nodes.length > 0"
                  :data="graphData"
                  :loading="graphLoading"
                  @node-click="handleGraphNodeClick"
                />
                <div v-else-if="!graphLoading" style="display: flex; align-items: center; justify-content: center; height: 100%">
                  <el-empty description="관계가 설정된 문서가 없습니다" />
                </div>
              </div>
            </div>
          </template>
        </el-card>
      </div>

      <!-- 리사이즈 핸들: 목록 ↔ 미리보기 -->
      <div v-if="showPreview && selectedDoc" class="resize-handle" @mousedown="startResize('preview', $event)" />

      <!-- 오른쪽: 미리보기 -->
      <el-card
        v-if="showPreview && selectedDoc"
        shadow="never"
        :body-style="{ padding: '0', height: '100%', overflow: 'auto' }"
        :style="{ width: previewWidth + 'px', flexShrink: 0, transition: isResizing ? 'none' : 'width 0.2s ease-out' }"
      >
        <div style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ebeef5">
          <span style="font-size: 13px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px">
            {{ selectedDoc.fileName }}
          </span>
          <el-button text size="small" @click="showPreview = false">닫기</el-button>
        </div>
        <DocumentPreview :document="selectedDoc" />
      </el-card>
    </div>

    <!-- 업로드 다이얼로그 -->
    <UploadDialog
      v-model:visible="showUpload"
      :domain-code="domainCode"
      :initial-filters="filters"
      @success="handleUploadSuccess"
    />

    <!-- 하위 도메인 생성/수정 다이얼로그 -->
    <el-dialog
      v-model="childDialogVisible"
      :title="childDialogMode === 'create' ? '하위 카테고리 추가' : '하위 카테고리 수정'"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px" label-position="left">
        <el-form-item v-if="childDialogMode === 'edit'" label="코드">
          <el-input :model-value="editingChildCode" disabled />
        </el-form-item>
        <el-form-item label="이름" required>
          <el-input v-model="childFormData.displayName" placeholder="예: 자동차보험 영업" maxlength="100" />
          <div v-if="childDialogMode === 'create'" style="font-size: 11px; color: #909399; margin-top: 2px">
            코드는 자동 생성됩니다
          </div>
        </el-form-item>
        <el-form-item label="설명">
          <el-input v-model="childFormData.description" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
        <el-form-item label="정렬 순서">
          <el-input-number v-model="childFormData.sortOrder" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="childDialogVisible = false">취소</el-button>
        <el-button type="primary" :loading="childDialogLoading" @click="handleChildSubmit">
          {{ childDialogMode === 'create' ? '생성' : '저장' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.child-domain-card {
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s;
  min-width: 120px;
  position: relative;
}

.child-domain-card:hover {
  border-color: #409eff;
}

.resize-handle {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 32px;
  background: #dcdfe6;
  border-radius: 1px;
  transition: background 0.15s, height 0.15s;
}

.resize-handle:hover::after {
  background: #409eff;
  height: 48px;
}

.is-resizing {
  cursor: col-resize;
}

.is-resizing * {
  pointer-events: none;
}

.is-resizing .resize-handle {
  pointer-events: auto;
}
</style>
