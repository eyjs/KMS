<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useDomainStore } from '@/stores/domain'
import { useAuthStore } from '@/stores/auth'
import CategoryTree from '@/components/domain/CategoryTree.vue'
import DocumentTable from '@/components/document/DocumentTable.vue'
import DocumentPreview from '@/components/document/DocumentPreview.vue'
import AddDocumentDialog from '@/components/domain/AddDocumentDialog.vue'
import RelationGraph from '@/components/graph/RelationGraph.vue'
import GraphNodeDrawer from '@/components/graph/GraphNodeDrawer.vue'
import { relationsApi } from '@/api/relations'
import type { DocumentEntity, RelationGraphResponse } from '@kms/shared'

const route = useRoute()
const router = useRouter()
const domainStore = useDomainStore()
const auth = useAuthStore()

const domainCode = computed(() => route.params.domainCode as string)
const selectedCategoryId = ref<number | null>(null)
const selectedDoc = ref<DocumentEntity | null>(null)
const showPreview = ref(true)
const showAddDocument = ref(false)
const activeTab = ref<'list' | 'graph'>('list')
const docTableRef = ref<InstanceType<typeof DocumentTable>>()
const categoryTreeRef = ref<InstanceType<typeof CategoryTree>>()

// 그래프 데이터
const graphData = ref<RelationGraphResponse | null>(null)
const graphLoading = ref(false)
const drawerVisible = ref(false)
const drawerNodeId = ref<string | null>(null)

const isAdmin = computed(() => auth.hasMinRole('ADMIN'))

// 현재 도메인이 하위 도메인을 가지는지 확인
const hasSubdomains = computed(() =>
  domainStore.domainsFlat.some((d) => d.parentCode === domainCode.value),
)

// 카테고리 미선택(전체) + 하위 도메인 존재 시 하위 문서 포함
const includeSubdomains = computed(() =>
  selectedCategoryId.value === null && hasSubdomains.value,
)

watch(domainCode, (code) => {
  if (code) {
    domainStore.setCurrentDomain(code)
    selectedCategoryId.value = null
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
  drawerNodeId.value = nodeId
  drawerVisible.value = true
}

function handleDrawerNavigate(docId: string) {
  // Drawer 내 관련 문서 클릭 시 해당 문서로 전환
  drawerNodeId.value = docId
}

async function handleGraphNodeDoubleClick(nodeId: string) {
  // 더블클릭: 해당 노드 중심으로 그래프 재로드
  graphLoading.value = true
  try {
    const { data } = await relationsApi.getGraph(nodeId, 3)
    graphData.value = data
  } catch {
    ElMessage.error('관계 그래프 로드에 실패했습니다')
  } finally {
    graphLoading.value = false
  }
}

function handleCategorySelect(categoryId: number | null) {
  selectedCategoryId.value = categoryId
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

function handleAddDocumentSuccess() {
  showAddDocument.value = false
  docTableRef.value?.refresh()
}

function openAddDocument() {
  showAddDocument.value = true
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
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
    <!-- 상단 도구모음 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-shrink: 0">
      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden">
        <h2 style="margin: 0; font-size: 18px; white-space: nowrap">
          {{ domainStore.currentDomain?.displayName ?? domainCode }}
        </h2>
        <el-tag size="small">{{ domainCode }}</el-tag>
      </div>
      <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0">
        <el-button type="primary" size="small" @click="openAddDocument">+ 문서 추가</el-button>
        <el-radio-group v-model="activeTab" size="small">
          <el-radio-button value="list">목록</el-radio-button>
          <el-radio-button value="graph">그래프</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 3-패널 레이아웃 -->
    <div :class="{ 'is-resizing': isResizing }" style="flex: 1; display: flex; min-height: 0; overflow: hidden">
      <!-- 왼쪽: 카테고리 트리 -->
      <el-card
        shadow="never"
        :body-style="{ padding: '0', height: '100%', overflow: 'auto' }"
        :style="{ width: treeWidth + 'px', flexShrink: 0 }"
      >
        <CategoryTree
          ref="categoryTreeRef"
          :domain-code="domainCode"
          :editable="isAdmin"
          @select="handleCategorySelect"
        />
      </el-card>

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
              :category-id="selectedCategoryId"
              :include-subdomains="includeSubdomains"
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
                  @node-double-click="handleGraphNodeDoubleClick"
                />
                <div v-else-if="!graphLoading" style="display: flex; align-items: center; justify-content: center; height: 100%">
                  <el-empty description="관계가 설정된 문서가 없습니다" />
                </div>
              </div>
            </div>
          </template>
        </el-card>
      </div>

      <!-- 리사이즈 핸들 -->
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

    <!-- 그래프 노드 사이드 패널 -->
    <GraphNodeDrawer
      v-model:visible="drawerVisible"
      :node-id="drawerNodeId"
      :domain-code="domainCode"
      @navigate="handleDrawerNavigate"
    />

    <!-- 문서 추가 다이얼로그 (업로드 + 기존 문서 배치 통합) -->
    <AddDocumentDialog
      v-model:visible="showAddDocument"
      :domain-code="domainCode"
      :domain-name="domainStore.currentDomain?.displayName ?? domainCode"
      @success="handleAddDocumentSuccess"
    />
  </div>
</template>

<style scoped>
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
