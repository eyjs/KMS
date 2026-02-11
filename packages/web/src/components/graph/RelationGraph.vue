<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Network } from 'vis-network/standalone'
import { DataSet } from 'vis-data/standalone'
import { LIFECYCLE_LABELS, FACET_TYPE_LABELS, SECURITY_LEVEL_LABELS } from '@kms/shared'
import type { GraphNode, GraphEdge, RelationGraphResponse } from '@kms/shared'

const props = defineProps<{
  data: RelationGraphResponse | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'node-click', nodeId: string): void
  (e: 'node-double-click', nodeId: string): void
  (e: 'edge-click', edgeId: string, relationType: string): void
}>()

const containerRef = ref<HTMLDivElement>()
let network: Network | null = null
let nodesDataSet: DataSet<Record<string, unknown>> | null = null
let edgesDataSet: DataSet<Record<string, unknown>> | null = null
// edge id → 관계유형 매핑 (간선 클릭 시 삭제 확인용)
const edgeRelationMap = new Map<string, string>()

// 라이프사이클별 노드 색상
const LIFECYCLE_COLORS: Record<string, { background: string; border: string }> = {
  ACTIVE: { background: '#67c23a', border: '#529b2e' },
  DRAFT: { background: '#909399', border: '#73767a' },
  DEPRECATED: { background: '#f56c6c', border: '#c45656' },
}

// 관계유형별 엣지 스타일
const EDGE_STYLES: Record<string, { color: string; dashes: boolean | number[]; label: string }> = {
  PARENT_OF: { color: '#409eff', dashes: false, label: '상위' },
  CHILD_OF: { color: '#409eff', dashes: false, label: '하위' },
  SIBLING: { color: '#e6a23c', dashes: false, label: '형제' },
  REFERENCE: { color: '#909399', dashes: [5, 5], label: '참조' },
  SUPERSEDES: { color: '#f56c6c', dashes: false, label: '대체' },
}

function buildNodeLabel(node: GraphNode): string {
  const name = node.fileName ?? node.docCode ?? node.id.slice(0, 8)
  return name.length > 20 ? name.slice(0, 18) + '...' : name
}

function buildNodeTitle(node: GraphNode): string {
  const lines: string[] = []
  if (node.docCode) lines.push(`코드: ${node.docCode}`)
  if (node.fileName) lines.push(`파일: ${node.fileName}`)
  lines.push(`도메인: ${node.domain}`)
  lines.push(`상태: ${LIFECYCLE_LABELS[node.lifecycle] ?? node.lifecycle}`)
  lines.push(`보안: ${SECURITY_LEVEL_LABELS[node.securityLevel] ?? node.securityLevel}`)
  if (Object.keys(node.classifications).length > 0) {
    lines.push(`분류: ${Object.entries(node.classifications).map(([k, v]) => `${FACET_TYPE_LABELS[k] ?? k}: ${v}`).join(', ')}`)
  }
  return lines.join('\n')
}

function buildVisNode(node: GraphNode, centerId: string) {
  const isCenter = node.id === centerId
  const colors = LIFECYCLE_COLORS[node.lifecycle] ?? LIFECYCLE_COLORS.DRAFT
  return {
    id: node.id,
    label: buildNodeLabel(node),
    title: buildNodeTitle(node),
    color: {
      background: colors.background,
      border: colors.border,
      highlight: { background: colors.background, border: '#303133' },
    },
    font: {
      color: '#303133',
      size: isCenter ? 14 : 12,
      bold: isCenter ? { color: '#303133', size: 14, face: 'sans-serif', mod: 'bold' } : undefined,
    },
    size: isCenter ? 30 : 20,
    shape: 'dot',
    borderWidth: isCenter ? 3 : 1,
    shadow: isCenter,
  }
}

function buildVisEdge(edge: GraphEdge) {
  const style = EDGE_STYLES[edge.relationType] ?? EDGE_STYLES.REFERENCE
  return {
    id: edge.id,
    from: edge.sourceId,
    to: edge.targetId,
    label: style.label,
    color: { color: style.color, highlight: style.color },
    dashes: style.dashes,
    arrows: {
      to: { enabled: edge.relationType !== 'SIBLING', scaleFactor: 0.8 },
    },
    font: { size: 10, color: '#909399', strokeWidth: 2, strokeColor: '#fff' },
    smooth: { type: 'curvedCW', roundness: 0.2 },
  }
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

  // 기존 네트워크 제거 후 새로 생성
  destroyNetwork()

  const { nodes, edges, centerId } = props.data

  const visNodes = nodes.map((node) => buildVisNode(node, centerId))
  const visEdges = edges.map((edge) => buildVisEdge(edge))

  // edge id → 관계유형 매핑 구성
  edgeRelationMap.clear()
  for (const edge of edges) {
    edgeRelationMap.set(edge.id, edge.relationType)
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
      tooltipDelay: 200,
      zoomView: true,
      dragView: true,
    },
    layout: { improvedLayout: true },
  })

  network.on('click', (params) => {
    if (params.nodes.length > 0) {
      emit('node-click', params.nodes[0] as string)
    } else if (params.edges.length > 0) {
      const edgeId = params.edges[0] as string
      const relType = edgeRelationMap.get(edgeId) ?? ''
      emit('edge-click', edgeId, relType)
    }
  })

  network.on('doubleClick', (params) => {
    if (params.nodes.length > 0) {
      emit('node-double-click', params.nodes[0] as string)
    }
  })
}

function mergeData(
  newNodes: Array<Record<string, unknown>>,
  newEdges: Array<Record<string, unknown>>,
) {
  if (!nodesDataSet || !edgesDataSet) return

  const existingNodeIds = new Set(nodesDataSet.getIds())
  const existingEdgeIds = new Set(edgesDataSet.getIds())

  const addNodes = newNodes.filter((n) => !existingNodeIds.has(n.id as string))
  const addEdges = newEdges.filter((e) => !existingEdgeIds.has(e.id as string))

  if (addNodes.length > 0) nodesDataSet.add(addNodes)
  if (addEdges.length > 0) edgesDataSet.add(addEdges)
}

/** 외부에서 확장 데이터를 병합할 때 사용 (더블클릭 확장) */
function mergeGraphData(response: RelationGraphResponse) {
  if (!nodesDataSet || !edgesDataSet) {
    renderGraph()
    return
  }

  // 확장 엣지의 관계유형 매핑 추가
  for (const edge of response.edges) {
    edgeRelationMap.set(edge.id, edge.relationType)
  }

  const visNodes = response.nodes.map((node) => buildVisNode(node, response.centerId))
  const visEdges = response.edges.map((edge) => buildVisEdge(edge))

  mergeData(visNodes, visEdges)
}

// data 변경 시 항상 새로 렌더 (관계 저장 후 갱신)
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

defineExpose({ mergeGraphData })
</script>

<template>
  <div style="position: relative; width: 100%; height: 100%">
    <div
      ref="containerRef"
      style="width: 100%; height: 100%"
    />
    <div
      v-if="loading"
      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.7)"
    >
      <el-icon class="is-loading" :size="24" style="color: #409eff">
        <i class="el-icon-loading" />
      </el-icon>
      <span style="margin-left: 8px; color: #606266">그래프 로딩중...</span>
    </div>
    <div
      v-if="!loading && !data"
      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #909399"
    >
      연결된 관계가 없습니다
    </div>
    <!-- 범례 -->
    <div
      v-if="data && data.nodes.length > 0"
      style="position: absolute; bottom: 8px; left: 8px; background: rgba(255,255,255,0.9); border-radius: 4px; padding: 6px 10px; font-size: 11px; box-shadow: 0 1px 4px rgba(0,0,0,0.1)"
    >
      <div style="display: flex; gap: 12px; flex-wrap: wrap">
        <span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #67c23a; vertical-align: middle" /> 사용중</span>
        <span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #909399; vertical-align: middle" /> 임시저장</span>
        <span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #f56c6c; vertical-align: middle" /> 만료</span>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px">
        <span style="color: #909399">--- 참조</span>
        <span style="color: #409eff">&mdash; 부모/자식</span>
        <span style="color: #f56c6c">&mdash; 대체</span>
      </div>
    </div>
  </div>
</template>
