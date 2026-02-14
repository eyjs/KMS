<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Network } from 'vis-network/standalone'
import { DataSet } from 'vis-data/standalone'
import { ElMessage } from 'element-plus'
import { knowledgeGraphApi } from '@/api/knowledge-graph'
import { LIFECYCLE_LABELS, SECURITY_LEVEL_LABELS } from '@kms/shared'
import type { KnowledgeGraphNode, OntologyEdge, OntologyGraphResponse, RelationTypeEntity } from '@kms/shared'

const props = defineProps<{
  data: OntologyGraphResponse | null
  loading?: boolean
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'node-click', nodeId: string): void
  (e: 'node-double-click', nodeId: string): void
  (e: 'updated'): void
}>()

const containerRef = ref<HTMLDivElement>()
let network: Network | null = null
let nodesDataSet: DataSet<Record<string, unknown>> | null = null
let edgesDataSet: DataSet<Record<string, unknown>> | null = null

// 선택된 엣지 정보
const selectedEdge = ref<OntologyEdge | null>(null)
const edgeMap = new Map<string, OntologyEdge>()

// 속성 패널 표시 여부
const showPropertyPanel = ref(false)

// 속성 폼
const propertyForm = ref({
  strength: '5',
  reason: '',
  confidence: 'manual',
})
const saving = ref(false)

// 라이프사이클별 노드 색상
const LIFECYCLE_COLORS: Record<string, { background: string; border: string }> = {
  ACTIVE: { background: '#67c23a', border: '#529b2e' },
  DRAFT: { background: '#909399', border: '#73767a' },
  DEPRECATED: { background: '#f56c6c', border: '#c45656' },
}

// 기본 엣지 스타일
const BASE_EDGE_COLORS: Record<string, string> = {
  PARENT_OF: '#409eff',
  CHILD_OF: '#409eff',
  SIBLING: '#e6a23c',
  REFERENCE: '#909399',
  SUPERSEDES: '#f56c6c',
  REFERENCED_BY: '#909399',
  SUPERSEDED_BY: '#f56c6c',
}

function buildNodeLabel(node: KnowledgeGraphNode): string {
  const name = node.fileName ?? node.docCode ?? node.id.slice(0, 8)
  return name.length > 20 ? name.slice(0, 18) + '...' : name
}

function buildNodeTitle(node: KnowledgeGraphNode): string {
  const lines: string[] = []
  if (node.docCode) lines.push(`코드: ${node.docCode}`)
  if (node.fileName) lines.push(`파일: ${node.fileName}`)
  lines.push(`상태: ${LIFECYCLE_LABELS[node.lifecycle] ?? node.lifecycle}`)
  lines.push(`보안: ${SECURITY_LEVEL_LABELS[node.securityLevel] ?? node.securityLevel}`)
  if (!node.accessible) lines.push('(접근 불가)')
  return lines.join('\n')
}

function buildVisNode(node: KnowledgeGraphNode, startId: string) {
  const isCenter = node.id === startId
  const colors = LIFECYCLE_COLORS[node.lifecycle] ?? LIFECYCLE_COLORS.DRAFT
  return {
    id: node.id,
    label: buildNodeLabel(node),
    title: buildNodeTitle(node),
    color: {
      background: node.accessible ? colors.background : '#dcdfe6',
      border: node.accessible ? colors.border : '#c0c4cc',
      highlight: { background: colors.background, border: '#303133' },
    },
    font: {
      color: node.accessible ? '#303133' : '#909399',
      size: isCenter ? 14 : 12,
    },
    size: isCenter ? 30 : 20,
    shape: 'dot',
    borderWidth: isCenter ? 3 : 1,
    shadow: isCenter,
  }
}

function buildVisEdge(edge: OntologyEdge) {
  const baseColor = BASE_EDGE_COLORS[edge.relationType] ?? '#909399'
  const hasProperties = edge.properties && Object.keys(edge.properties).length > 0
  const strength = edge.properties?.strength ? parseInt(edge.properties.strength) : 5

  // 속성이 있으면 선 두께 증가 + 글로우 효과
  const width = hasProperties ? 2 + (strength / 5) : 1

  return {
    id: edge.id,
    from: edge.sourceId,
    to: edge.targetId,
    label: edge.label,
    color: {
      color: baseColor,
      highlight: baseColor,
      hover: baseColor,
    },
    width,
    dashes: edge.relationType === 'REFERENCE' ? [5, 5] : false,
    arrows: {
      to: { enabled: !edge.isBidirectional, scaleFactor: 0.8 },
    },
    font: { size: 10, color: '#606266', strokeWidth: 2, strokeColor: '#fff' },
    smooth: { type: 'curvedCW', roundness: 0.2 },
    // 속성 툴팁
    title: buildEdgeTitle(edge),
  }
}

function buildEdgeTitle(edge: OntologyEdge): string {
  const lines: string[] = [`관계: ${edge.label}`]
  if (edge.properties) {
    if (edge.properties.reason) lines.push(`이유: ${edge.properties.reason}`)
    if (edge.properties.strength) lines.push(`강도: ${edge.properties.strength}/10`)
    if (edge.properties.confidence) {
      const labels: Record<string, string> = { manual: '확실함', auto: '검증됨', suggested: '검토필요' }
      lines.push(`신뢰도: ${labels[edge.properties.confidence] ?? edge.properties.confidence}`)
    }
  }
  if (props.editable) {
    lines.push('')
    lines.push('클릭하여 속성 설정')
  }
  return lines.join('\n')
}

function destroyNetwork() {
  if (network) {
    network.destroy()
    network = null
  }
  nodesDataSet = null
  edgesDataSet = null
}

function renderGraph() {
  if (!containerRef.value || !props.data) return

  destroyNetwork()

  const { nodes, edges, meta } = props.data

  const visNodes = nodes.map((node) => buildVisNode(node, meta.startId))
  const visEdges = edges.map((edge) => buildVisEdge(edge))

  // 엣지 맵 구성
  edgeMap.clear()
  for (const edge of edges) {
    edgeMap.set(edge.id, edge)
  }

  nodesDataSet = new DataSet(visNodes)
  edgesDataSet = new DataSet(visEdges)

  network = new Network(containerRef.value, { nodes: nodesDataSet, edges: edgesDataSet }, {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -80, springLength: 150 },
      stabilization: { iterations: 100 },
    },
    interaction: {
      hover: true,
      tooltipDelay: 300,
      zoomView: true,
      dragView: true,
    },
    layout: { improvedLayout: true },
  })

  network.on('click', (params) => {
    if (params.nodes.length > 0) {
      emit('node-click', params.nodes[0] as string)
      closePropertyPanel()
    } else if (params.edges.length > 0 && props.editable) {
      const edgeId = params.edges[0] as string
      const edge = edgeMap.get(edgeId)
      if (edge) {
        openPropertyPanel(edge)
      }
    } else {
      closePropertyPanel()
    }
  })

  network.on('doubleClick', (params) => {
    if (params.nodes.length > 0) {
      emit('node-double-click', params.nodes[0] as string)
    }
  })
}

function openPropertyPanel(edge: OntologyEdge) {
  selectedEdge.value = edge
  propertyForm.value = {
    strength: edge.properties?.strength ?? '5',
    reason: edge.properties?.reason ?? '',
    confidence: edge.properties?.confidence ?? 'manual',
  }
  showPropertyPanel.value = true
}

function closePropertyPanel() {
  showPropertyPanel.value = false
  selectedEdge.value = null
}

async function saveProperties() {
  if (!selectedEdge.value) return

  saving.value = true
  try {
    const relationId = selectedEdge.value.id

    // 강도 저장
    if (propertyForm.value.strength && propertyForm.value.strength !== '5') {
      await knowledgeGraphApi.setRelationProperty(relationId, 'strength', propertyForm.value.strength)
    }

    // 이유 저장
    if (propertyForm.value.reason) {
      await knowledgeGraphApi.setRelationProperty(relationId, 'reason', propertyForm.value.reason)
    }

    // 신뢰도 저장
    if (propertyForm.value.confidence && propertyForm.value.confidence !== 'manual') {
      await knowledgeGraphApi.setRelationProperty(relationId, 'confidence', propertyForm.value.confidence)
    }

    ElMessage.success('속성이 저장되었습니다')
    closePropertyPanel()
    emit('updated')
  } catch (error) {
    console.error('Failed to save properties:', error)
    ElMessage.error('저장에 실패했습니다')
  } finally {
    saving.value = false
  }
}

async function clearProperties() {
  if (!selectedEdge.value) return

  saving.value = true
  try {
    const relationId = selectedEdge.value.id

    // 모든 속성 삭제
    const keys = ['strength', 'reason', 'confidence', 'validUntil']
    for (const key of keys) {
      try {
        await knowledgeGraphApi.deleteRelationProperty(relationId, key)
      } catch {
        // 없으면 무시
      }
    }

    ElMessage.success('속성이 해제되었습니다')
    closePropertyPanel()
    emit('updated')
  } catch (error) {
    console.error('Failed to clear properties:', error)
    ElMessage.error('해제에 실패했습니다')
  } finally {
    saving.value = false
  }
}

// 관계 유형 범례
const relationTypeLegend = computed(() => {
  if (!props.data?.relationTypes) return []
  return props.data.relationTypes.map((rt) => ({
    code: rt.code,
    label: rt.labelKo,
    color: BASE_EDGE_COLORS[rt.code] ?? '#909399',
  }))
})

watch(() => props.data, (newData) => {
  if (newData) {
    renderGraph()
  }
})

onMounted(() => {
  if (props.data) {
    renderGraph()
  }
})

onUnmounted(() => {
  destroyNetwork()
})
</script>

<template>
  <div style="position: relative; width: 100%; height: 100%">
    <!-- 그래프 캔버스 -->
    <div
      ref="containerRef"
      style="width: 100%; height: 100%"
    />

    <!-- 로딩 -->
    <div
      v-if="loading"
      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.7)"
    >
      <span style="color: #606266">그래프 로딩중...</span>
    </div>

    <!-- 빈 상태 -->
    <div
      v-if="!loading && !data"
      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #909399"
    >
      연결된 관계가 없습니다
    </div>

    <!-- 범례 (관계 유형) -->
    <div
      v-if="data && relationTypeLegend.length > 0"
      style="position: absolute; bottom: 8px; left: 8px; background: rgba(255,255,255,0.95); border-radius: 6px; padding: 8px 12px; font-size: 11px; box-shadow: 0 2px 8px rgba(0,0,0,0.1)"
    >
      <div style="font-weight: 600; margin-bottom: 6px; color: #303133">관계 유형</div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        <span
          v-for="rt in relationTypeLegend"
          :key="rt.code"
          style="display: flex; align-items: center; gap: 4px"
        >
          <span
            :style="{
              display: 'inline-block',
              width: '16px',
              height: '2px',
              background: rt.color,
              borderRadius: '1px',
            }"
          />
          <span>{{ rt.label }}</span>
        </span>
      </div>
      <div v-if="editable" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #ebeef5; color: #909399; font-size: 10px">
        선(엣지)을 클릭하여 속성 설정
      </div>
    </div>

    <!-- 속성 설정 패널 (오른쪽 사이드) -->
    <transition name="slide-right">
      <div
        v-if="showPropertyPanel && selectedEdge"
        style="position: absolute; top: 8px; right: 8px; width: 280px; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); overflow: hidden"
      >
        <div style="padding: 12px 16px; background: #f5f7fa; border-bottom: 1px solid #ebeef5; display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: 600; color: #303133">관계 속성</span>
          <el-button text size="small" @click="closePropertyPanel">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </el-button>
        </div>

        <div style="padding: 16px">
          <div style="margin-bottom: 12px">
            <el-tag size="small" type="info">{{ selectedEdge.label }}</el-tag>
          </div>

          <!-- 강도 슬라이더 -->
          <div style="margin-bottom: 16px">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
              <span style="font-size: 12px; color: #606266">관계 강도</span>
              <span style="font-size: 12px; color: #909399">{{ propertyForm.strength }}/10</span>
            </div>
            <el-slider
              v-model.number="propertyForm.strength"
              :min="1"
              :max="10"
              :step="1"
              :show-tooltip="false"
            />
          </div>

          <!-- 이유 -->
          <div style="margin-bottom: 16px">
            <div style="font-size: 12px; color: #606266; margin-bottom: 4px">관계 이유</div>
            <el-input
              v-model="propertyForm.reason"
              type="textarea"
              :rows="2"
              placeholder="이 관계의 의미를 설명"
              resize="none"
            />
          </div>

          <!-- 신뢰도 -->
          <div style="margin-bottom: 16px">
            <div style="font-size: 12px; color: #606266; margin-bottom: 4px">신뢰도</div>
            <el-radio-group v-model="propertyForm.confidence" size="small">
              <el-radio-button value="manual">확실</el-radio-button>
              <el-radio-button value="auto">검증</el-radio-button>
              <el-radio-button value="suggested">검토</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 버튼 -->
          <div style="display: flex; gap: 8px">
            <el-button
              size="small"
              style="flex: 1"
              :loading="saving"
              @click="clearProperties"
            >
              해제
            </el-button>
            <el-button
              type="primary"
              size="small"
              style="flex: 1"
              :loading="saving"
              @click="saveProperties"
            >
              저장
            </el-button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
