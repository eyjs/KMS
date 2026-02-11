<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { relationsApi } from '@/api/relations'
import { LIFECYCLE_LABELS, FRESHNESS_LABELS, SECURITY_LEVEL_LABELS, RELATION_TYPE_LABELS } from '@kms/shared'
import type { DocumentEntity, RelationType, RelationGraphResponse } from '@kms/shared'
import { useFacetTypes } from '@/composables/useFacetTypes'
import { ElMessage, ElMessageBox } from 'element-plus'
import RelationGraph from '@/components/graph/RelationGraph.vue'
import DocumentExplorer from '@/components/document/DocumentExplorer.vue'

const route = useRoute()
const router = useRouter()

const domainCode = computed(() => route.params.domainCode as string)
const sourceId = computed(() => route.query.source as string | undefined)

const sourceDoc = ref<DocumentEntity | null>(null)
const targetDoc = ref<DocumentEntity | null>(null)
const loading = ref(false)
const saving = ref(false)

// 그래프
const graphData = ref<RelationGraphResponse | null>(null)
const graphLoading = ref(false)
const graphRef = ref<InstanceType<typeof RelationGraph>>()

// 관계 유형
const relationType = ref<RelationType>('REFERENCE')
const RELATION_OPTIONS: Array<{ value: RelationType; label: string; desc: string }> = [
  { value: 'PARENT_OF', label: '상위', desc: '이 문서가 대상의 상위 문서' },
  { value: 'CHILD_OF', label: '하위', desc: '이 문서가 대상의 하위 문서' },
  { value: 'SIBLING', label: '형제', desc: '같은 수준의 관련 문서' },
  { value: 'REFERENCE', label: '참조', desc: '단방향 참조 관계' },
  { value: 'SUPERSEDES', label: '대체', desc: '이 문서가 대상을 대체' },
]

const { loadFacetTypes, facetLabel } = useFacetTypes()

onMounted(async () => {
  await loadFacetTypes()
  if (sourceId.value) {
    loading.value = true
    try {
      const { data } = await documentsApi.get(sourceId.value)
      sourceDoc.value = data
      loadGraph(sourceId.value)
    } catch {
      ElMessage.error('출발 문서를 불러올 수 없습니다')
    } finally {
      loading.value = false
    }
  }
})

async function loadGraph(documentId: string) {
  graphLoading.value = true
  try {
    const { data } = await relationsApi.getGraph(documentId, 1)
    graphData.value = data
  } catch {
    graphData.value = null
  } finally {
    graphLoading.value = false
  }
}

function handleNodeClick(nodeId: string) {
  if (nodeId === sourceId.value) return
  // 그래프 노드 클릭 → 대상 문서 선택
  selectTargetById(nodeId)
}

async function handleNodeDoubleClick(nodeId: string) {
  // 그래프 확장: 해당 노드 기준 depth=1 추가 로드
  try {
    graphLoading.value = true
    const { data } = await relationsApi.getGraph(nodeId, 1)
    graphRef.value?.mergeGraphData(data)
  } catch {
    ElMessage.warning('관계 확장에 실패했습니다')
  } finally {
    graphLoading.value = false
  }
}

// 탐색기에 전달할 기존 관계 Map
const existingRelationsMap = computed(() => {
  const map = new Map<string, string>()
  if (!graphData.value) return map
  for (const edge of graphData.value.edges) {
    const relLabel = RELATION_TYPE_LABELS[edge.relationType] ?? edge.relationType
    // 소스 문서 기준으로 관련 문서 ID → 관계 라벨
    if (edge.sourceId === sourceId.value && !map.has(edge.targetId)) {
      map.set(edge.targetId, relLabel)
    }
    if (edge.targetId === sourceId.value && !map.has(edge.sourceId)) {
      map.set(edge.sourceId, relLabel)
    }
  }
  return map
})

async function handleEdgeClick(edgeId: string, relationType: string) {
  const relLabel = RELATION_TYPE_LABELS[relationType] ?? relationType
  try {
    await ElMessageBox.confirm(
      `"${relLabel}" 관계를 삭제하시겠습니까?`,
      '관계 삭제',
      { confirmButtonText: '삭제', cancelButtonText: '취소', type: 'warning' },
    )
    await relationsApi.delete(edgeId)
    ElMessage.success('관계가 삭제되었습니다')
    if (sourceId.value) loadGraph(sourceId.value)
  } catch (err: unknown) {
    // ElMessageBox cancel은 무시
    if (err === 'cancel') return
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '관계 삭제에 실패했습니다'
    ElMessage.error(msg)
  }
}

async function selectTargetById(id: string) {
  try {
    const { data } = await documentsApi.get(id)
    targetDoc.value = data
  } catch {
    ElMessage.error('문서 정보를 불러올 수 없습니다')
  }
}

function handleExplorerSelect(doc: DocumentEntity) {
  targetDoc.value = doc
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
    // 관계 저장 후 그래프 새로고침
    targetDoc.value = null
    if (sourceId.value) loadGraph(sourceId.value)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '관계 설정에 실패했습니다'
    ElMessage.error(msg)
  } finally {
    saving.value = false
  }
}

function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else if (sourceDoc.value) {
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
      <span style="font-size: 16px; font-weight: 600">관계 설정</span>
      <span v-if="sourceDoc" style="font-size: 13px; color: #606266">
        {{ sourceDoc.docCode ?? '' }} {{ sourceDoc.fileName ?? '' }}
      </span>
    </div>

    <!-- 상단: 지식 그래프 -->
    <el-card shadow="never" style="flex-shrink: 0; margin-bottom: 8px" :body-style="{ padding: '0', height: '280px' }">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 13px">지식 그래프</span>
          <span style="font-size: 11px; color: #909399">노드 클릭: 대상 선택 | 더블클릭: 확장 | 간선 클릭: 삭제</span>
        </div>
      </template>
      <RelationGraph
        ref="graphRef"
        :data="graphData"
        :loading="graphLoading"
        @node-click="handleNodeClick"
        @node-double-click="handleNodeDoubleClick"
        @edge-click="handleEdgeClick"
      />
    </el-card>

    <!-- 하단: 탐색기 + 관계 폼 -->
    <div style="flex: 1; display: flex; gap: 8px; min-height: 0; overflow: hidden">
      <!-- 왼쪽: 문서 탐색기 -->
      <el-card
        shadow="never"
        style="flex: 1; min-width: 0; display: flex; flex-direction: column"
        :body-style="{ flex: 1, padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }"
      >
        <template #header>
          <span style="font-weight: 600; font-size: 13px">문서 탐색기</span>
        </template>
        <DocumentExplorer
          v-if="sourceDoc"
          :source-document="sourceDoc"
          :exclude-id="sourceId"
          :existing-relations="existingRelationsMap"
          @select="handleExplorerSelect"
        />
      </el-card>

      <!-- 오른쪽: 관계 설정 폼 -->
      <el-card
        shadow="never"
        style="width: 320px; flex-shrink: 0; display: flex; flex-direction: column"
        :body-style="{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }"
      >
        <template #header>
          <span style="font-weight: 600; font-size: 13px">관계 추가</span>
        </template>

        <!-- 대상 문서 -->
        <div style="margin-bottom: 16px">
          <div style="font-size: 12px; color: #909399; margin-bottom: 6px">대상 문서</div>
          <div v-if="targetDoc" style="background: #f5f7fa; border-radius: 6px; padding: 10px">
            <div style="display: flex; justify-content: space-between; align-items: flex-start">
              <div style="flex: 1; min-width: 0">
                <div style="font-size: 13px; font-weight: 500; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                  {{ targetDoc.fileName ?? '(제목 없음)' }}
                </div>
                <div v-if="targetDoc.docCode" style="font-size: 11px; color: #909399; margin-top: 2px">
                  {{ targetDoc.docCode }}
                </div>
              </div>
              <el-button text size="small" type="primary" @click="targetDoc = null" style="flex-shrink: 0">변경</el-button>
            </div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px">
              <el-tag size="small" :type="targetDoc.lifecycle === 'ACTIVE' ? 'success' : targetDoc.lifecycle === 'DRAFT' ? 'info' : 'danger'">
                {{ LIFECYCLE_LABELS[targetDoc.lifecycle] ?? targetDoc.lifecycle }}
              </el-tag>
              <el-tag size="small">{{ SECURITY_LEVEL_LABELS[targetDoc.securityLevel] ?? targetDoc.securityLevel }}</el-tag>
            </div>
            <div style="font-size: 11px; color: #606266; margin-top: 4px">
              {{ targetDoc.domain }}
              <template v-for="(value, key) in targetDoc.classifications" :key="key">
                <span style="margin-left: 6px">{{ facetLabel(String(key)) }}: {{ value }}</span>
              </template>
            </div>
          </div>
          <div v-else style="background: #f5f7fa; border-radius: 6px; padding: 20px; text-align: center; color: #909399; font-size: 12px">
            그래프 노드를 클릭하거나<br>탐색기에서 문서를 선택하세요
          </div>
        </div>

        <!-- 관계 유형 -->
        <div style="margin-bottom: 16px">
          <div style="font-size: 12px; color: #909399; margin-bottom: 6px">관계 유형</div>
          <el-radio-group v-model="relationType" style="display: flex; flex-direction: column; gap: 4px">
            <el-radio
              v-for="opt in RELATION_OPTIONS"
              :key="opt.value"
              :value="opt.value"
              style="height: auto; margin-right: 0"
            >
              <span style="font-size: 13px">{{ opt.label }}</span>
              <span style="font-size: 11px; color: #909399; margin-left: 4px">{{ opt.desc }}</span>
            </el-radio>
          </el-radio-group>
        </div>

        <div style="flex: 1" />

        <!-- 저장/취소 -->
        <div style="display: flex; gap: 8px">
          <el-button style="flex: 1" @click="goBack">취소</el-button>
          <el-button
            type="primary"
            style="flex: 1"
            :loading="saving"
            :disabled="!sourceDoc || !targetDoc"
            @click="handleSave"
          >
            저장
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>
