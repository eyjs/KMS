<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { knowledgeGraphApi } from '@/api/knowledge-graph'
import { documentsApi } from '@/api/documents'
import { useAuthStore } from '@/stores/auth'
import type { OntologyGraphResponse, DocumentEntity, RelationType } from '@kms/shared'
import { ElMessage } from 'element-plus'
import OntologyGraph from '@/components/graph/OntologyGraph.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// URL 파라미터
const startId = computed(() => route.query.start as string | undefined)

// 상태
const loading = ref(false)
const graphData = ref<OntologyGraphResponse | null>(null)
const centerDoc = ref<DocumentEntity | null>(null)

// 설정
const depth = ref(2)
const relationTypes = ref<RelationType[]>([])
const maxNodes = ref(50)

// 관계 유형 옵션
const RELATION_TYPE_OPTIONS: Array<{ value: RelationType; label: string }> = [
  { value: 'PARENT_OF', label: '상위 문서' },
  { value: 'CHILD_OF', label: '하위 문서' },
  { value: 'SIBLING', label: '형제 문서' },
  { value: 'REFERENCE', label: '참조 문서' },
  { value: 'SUPERSEDES', label: '대체 문서' },
]

// 문서 검색
const searchQuery = ref('')
const searchResults = ref<DocumentEntity[]>([])
const searching = ref(false)

async function loadGraph(documentId: string) {
  loading.value = true
  try {
    // 문서 정보 로드
    const docRes = await documentsApi.get(documentId)
    centerDoc.value = docRes.data

    // 온톨로지 그래프 로드
    const graphRes = await knowledgeGraphApi.exploreOntology(
      documentId,
      depth.value,
      relationTypes.value.length > 0 ? relationTypes.value : undefined,
      maxNodes.value,
    )
    graphData.value = graphRes.data

    // URL 업데이트
    router.replace({ query: { ...route.query, start: documentId } })
  } catch (error) {
    console.error('Failed to load graph:', error)
    ElMessage.error('그래프를 불러올 수 없습니다')
    graphData.value = null
  } finally {
    loading.value = false
  }
}

async function searchDocuments() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  searching.value = true
  try {
    const { data } = await documentsApi.search({ q: searchQuery.value, page: 1, size: 10 })
    searchResults.value = data.data
  } catch {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

function selectDocument(doc: DocumentEntity) {
  searchQuery.value = ''
  searchResults.value = []
  loadGraph(doc.id)
}

function handleNodeClick(nodeId: string) {
  // 노드 클릭 시 해당 문서로 이동 (옵션)
}

function handleNodeDoubleClick(nodeId: string) {
  // 더블클릭 시 해당 노드를 중심으로 재탐색
  loadGraph(nodeId)
}

function handleGraphUpdated() {
  // 속성 변경 후 그래프 새로고침
  if (centerDoc.value) {
    loadGraph(centerDoc.value.id)
  }
}

function goToDocument() {
  if (centerDoc.value) {
    router.push(`/d/_/doc/${centerDoc.value.id}`)
  }
}

// 설정 변경 시 재로드
watch([depth, relationTypes, maxNodes], () => {
  if (centerDoc.value) {
    loadGraph(centerDoc.value.id)
  }
})

onMounted(() => {
  if (startId.value) {
    loadGraph(startId.value)
  }
})
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column">
    <!-- 헤더 -->
    <div style="padding: 16px 24px; background: #fff; border-bottom: 1px solid #ebeef5; display: flex; align-items: center; gap: 16px">
      <h2 style="margin: 0; font-size: 18px; font-weight: 600">지식그래프 탐색</h2>

      <!-- 문서 검색 -->
      <el-popover
        placement="bottom-start"
        :width="400"
        trigger="focus"
        :visible="searchResults.length > 0"
      >
        <template #reference>
          <el-input
            v-model="searchQuery"
            placeholder="문서 검색 (파일명, 코드)"
            style="width: 300px"
            :prefix-icon="searching ? 'Loading' : 'Search'"
            clearable
            @input="searchDocuments"
          />
        </template>
        <div style="max-height: 300px; overflow-y: auto">
          <div
            v-for="doc in searchResults"
            :key="doc.id"
            style="padding: 8px 12px; cursor: pointer; border-radius: 4px"
            class="search-result-item"
            @click="selectDocument(doc)"
          >
            <div style="font-weight: 500">{{ doc.fileName ?? doc.docCode }}</div>
            <div style="font-size: 12px; color: #909399">{{ doc.docCode }}</div>
          </div>
        </div>
      </el-popover>

      <div style="flex: 1" />

      <!-- 설정 -->
      <div style="display: flex; align-items: center; gap: 12px">
        <span style="font-size: 13px; color: #606266">깊이:</span>
        <el-select v-model="depth" size="small" style="width: 80px">
          <el-option :value="1" label="1단계" />
          <el-option :value="2" label="2단계" />
          <el-option :value="3" label="3단계" />
        </el-select>

        <span style="font-size: 13px; color: #606266">관계:</span>
        <el-select
          v-model="relationTypes"
          size="small"
          multiple
          collapse-tags
          placeholder="전체"
          style="width: 150px"
        >
          <el-option
            v-for="opt in RELATION_TYPE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          />
        </el-select>

        <span style="font-size: 13px; color: #606266">최대:</span>
        <el-select v-model="maxNodes" size="small" style="width: 80px">
          <el-option :value="30" label="30개" />
          <el-option :value="50" label="50개" />
          <el-option :value="100" label="100개" />
        </el-select>
      </div>
    </div>

    <!-- 메인 -->
    <div style="flex: 1; display: flex; min-height: 0">
      <!-- 왼쪽: 중심 문서 정보 -->
      <div
        v-if="centerDoc"
        style="width: 280px; background: #fafafa; border-right: 1px solid #ebeef5; padding: 16px; overflow-y: auto"
      >
        <div style="font-size: 12px; color: #909399; margin-bottom: 8px">중심 문서</div>
        <el-card shadow="never">
          <div style="font-weight: 600; margin-bottom: 8px">
            {{ centerDoc.fileName ?? '(파일 없음)' }}
          </div>
          <div style="font-size: 12px; color: #606266; margin-bottom: 4px">
            {{ centerDoc.docCode }}
          </div>
          <div style="display: flex; gap: 4px; margin-bottom: 12px">
            <el-tag size="small" :type="centerDoc.lifecycle === 'ACTIVE' ? 'success' : 'info'">
              {{ centerDoc.lifecycle }}
            </el-tag>
            <el-tag size="small" type="warning">{{ centerDoc.securityLevel }}</el-tag>
          </div>
          <el-button size="small" style="width: 100%" @click="goToDocument">
            문서 상세 보기
          </el-button>
        </el-card>

        <!-- 통계 -->
        <div v-if="graphData" style="margin-top: 16px">
          <div style="font-size: 12px; color: #909399; margin-bottom: 8px">그래프 통계</div>
          <div style="background: #fff; border-radius: 6px; padding: 12px">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
              <span style="color: #909399; font-size: 12px">노드 수</span>
              <span style="font-weight: 600">{{ graphData.meta.totalNodes }}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
              <span style="color: #909399; font-size: 12px">접근 가능</span>
              <span style="font-weight: 600">{{ graphData.meta.accessibleNodes }}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
              <span style="color: #909399; font-size: 12px">관계 수</span>
              <span style="font-weight: 600">{{ graphData.edges.length }}</span>
            </div>
            <div style="display: flex; justify-content: space-between">
              <span style="color: #909399; font-size: 12px">탐색 깊이</span>
              <span style="font-weight: 600">{{ graphData.meta.maxDepth }}</span>
            </div>
          </div>
        </div>

        <!-- 도움말 -->
        <div style="margin-top: 16px; padding: 12px; background: #ecf5ff; border-radius: 6px; font-size: 12px; color: #409eff">
          <div style="font-weight: 600; margin-bottom: 4px">사용법</div>
          <ul style="margin: 0; padding-left: 16px; line-height: 1.6">
            <li>노드 더블클릭: 해당 문서 중심 탐색</li>
            <li>선(엣지) 클릭: 속성 설정</li>
            <li>드래그: 그래프 이동</li>
            <li>스크롤: 확대/축소</li>
          </ul>
        </div>
      </div>

      <!-- 오른쪽: 그래프 -->
      <div style="flex: 1; position: relative">
        <OntologyGraph
          v-if="centerDoc"
          :data="graphData"
          :loading="loading"
          :editable="auth.hasMinRole('EDITOR')"
          @node-click="handleNodeClick"
          @node-double-click="handleNodeDoubleClick"
          @updated="handleGraphUpdated"
        />
        <div
          v-else
          style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; color: #909399"
        >
          <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor" style="opacity: 0.3; margin-bottom: 16px">
            <path d="M14.1 9.9l-1.4-1.4L9.9 11.3 8.5 9.9 11.3 7.1l-1.4-1.4L7.1 8.5 5.7 7.1 9.6 3.2c1.2-1.2 3.1-1.2 4.2 0l7 7c1.2 1.2 1.2 3.1 0 4.2l-3.9 3.9-1.4-1.4 2.5-2.5-1.4-1.4-2.5 2.5-1.4-1.4 2.5-2.5zm-4.2 4.2l1.4 1.4-2.5 2.5 1.4 1.4 2.5-2.5 1.4 1.4-2.5 2.5 1.4 1.4 3.9-3.9c1.2-1.2 1.2-3.1 0-4.2l-7-7c-1.2-1.2-3.1-1.2-4.2 0L3.2 9.6l1.4 1.4 2.5-2.5 1.4 1.4L6 12.5l1.4 1.4z"/>
          </svg>
          <div style="font-size: 14px; margin-bottom: 8px">문서를 검색하여 지식그래프를 탐색하세요</div>
          <div style="font-size: 12px">선(엣지)을 클릭하면 관계에 의미를 부여할 수 있습니다</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-result-item:hover {
  background: #f5f7fa;
}
</style>
