<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDomainStore } from '@/stores/domain'
import { relationsApi } from '@/api/relations'
import RelationGraph from '@/components/graph/RelationGraph.vue'
import { ElMessage } from 'element-plus'
import type { RelationGraphResponse } from '@kms/shared'

const router = useRouter()
const domainStore = useDomainStore()

const loading = ref(false)
const graphData = ref<RelationGraphResponse | null>(null)
const hasMore = ref(false)
const selectedDomain = ref<string>('')
const maxNodes = ref(200)

const graphRef = ref<InstanceType<typeof RelationGraph>>()

async function loadGraph() {
  loading.value = true
  try {
    const res = await relationsApi.getGlobalGraph(
      selectedDomain.value || undefined,
      maxNodes.value,
    )
    // GlobalGraphResponse를 RelationGraphResponse로 변환
    graphData.value = {
      nodes: res.data.nodes,
      edges: res.data.edges,
      centerId: '', // 전역 그래프는 center가 없음
    }
    hasMore.value = res.data.hasMore
  } catch (e) {
    ElMessage.error('관계 그래프 로드에 실패했습니다')
    graphData.value = null
  } finally {
    loading.value = false
  }
}

function handleNodeClick(nodeId: string) {
  // 클릭한 노드(문서)로 이동
  // 도메인 필터가 있으면 해당 도메인, 없으면 _
  const domainCode = selectedDomain.value || '_'
  router.push(`/d/${domainCode}/doc/${nodeId}`)
}

function handleNodeDoubleClick(nodeId: string) {
  // 더블클릭: 해당 노드 중심으로 확장 (문서 상세로 이동)
  const domainCode = selectedDomain.value || '_'
  router.push(`/d/${domainCode}/doc/${nodeId}`)
}

watch(selectedDomain, () => {
  loadGraph()
})

onMounted(() => {
  loadGraph()
})
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column; gap: 16px; overflow: hidden">
    <!-- 헤더 -->
    <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0">
      <h2 style="margin: 0; font-size: 20px">관계 그래프</h2>
      <div style="display: flex; align-items: center; gap: 12px">
        <el-select
          v-model="selectedDomain"
          placeholder="전체 도메인"
          clearable
          filterable
          style="width: 200px"
        >
          <el-option
            v-for="d in domainStore.domainsFlat"
            :key="d.code"
            :label="d.displayName"
            :value="d.code"
          />
        </el-select>
        <el-button @click="loadGraph" :loading="loading">
          <el-icon><component is="Refresh" /></el-icon>
          새로고침
        </el-button>
      </div>
    </div>

    <!-- 그래프 영역 -->
    <div style="flex: 1; min-height: 0; background: white; border-radius: 8px; overflow: hidden; position: relative">
      <relation-graph
        ref="graphRef"
        :data="graphData"
        :loading="loading"
        @node-click="handleNodeClick"
        @node-double-click="handleNodeDoubleClick"
      />

      <!-- 노드 수 초과 경고 -->
      <div
        v-if="hasMore && !loading"
        style="position: absolute; top: 8px; right: 8px; background: #fef0f0; color: #f56c6c; padding: 8px 12px; border-radius: 4px; font-size: 12px"
      >
        노드 수가 {{ maxNodes }}개를 초과하여 일부만 표시됩니다.
        도메인 필터를 사용해 범위를 좁혀 주세요.
      </div>

      <!-- 빈 상태 -->
      <div
        v-if="!loading && graphData && graphData.nodes.length === 0"
        style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #909399"
      >
        <el-icon :size="48" style="margin-bottom: 12px"><component is="Share" /></el-icon>
        <div>관계가 설정된 문서가 없습니다</div>
        <div style="font-size: 12px; margin-top: 4px">문서 상세 페이지에서 관계를 추가할 수 있습니다</div>
      </div>
    </div>

    <!-- 안내 -->
    <div style="flex-shrink: 0; color: #909399; font-size: 12px; text-align: center">
      노드를 클릭하면 문서 상세로 이동합니다. 마우스 휠로 확대/축소, 드래그로 이동할 수 있습니다.
    </div>
  </div>
</template>
