<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import { FACET_TYPE_LABELS, LIFECYCLE_LABELS } from '@kms/shared'
import type { DocumentEntity, DomainMasterEntity } from '@kms/shared'

const props = defineProps<{
  sourceDocument: DocumentEntity
  excludeId?: string
  existingRelations?: Map<string, string>
}>()

const emit = defineEmits<{
  (e: 'select', doc: DocumentEntity): void
}>()

const domains = ref<DomainMasterEntity[]>([])
const activeDomain = ref('')
const searchQuery = ref('')
const documents = ref<DocumentEntity[]>([])
const siblings = ref<DocumentEntity[]>([])
const loading = ref(false)
const page = ref(1)
const totalPages = ref(0)
const PAGE_SIZE = 20

// 탭: siblings(형제 문서) | all(전체) | search(검색)
const activeTab = ref<'siblings' | 'all' | 'search'>('siblings')

onMounted(async () => {
  try {
    const { data } = await taxonomyApi.getDomainsFlat()
    domains.value = data
    activeDomain.value = props.sourceDocument.domain
  } catch {
    domains.value = []
  }
})

// 도메인 변경 시 문서 목록 다시 로드
watch(activeDomain, () => {
  page.value = 1
  if (activeTab.value === 'all') {
    loadDocuments()
  }
  if (activeTab.value === 'siblings') {
    loadSiblings()
  }
})

watch(activeTab, (tab) => {
  page.value = 1
  if (tab === 'siblings') loadSiblings()
  else if (tab === 'all') loadDocuments()
})

// sourceDocument 변경 시 도메인 동기화 (activeDomain watch가 로드 처리)
watch(() => props.sourceDocument, () => {
  activeDomain.value = props.sourceDocument.domain
}, { immediate: true })

async function loadSiblings() {
  loading.value = true
  try {
    const cls = props.sourceDocument.classifications
    const classificationStr = Object.keys(cls).length > 0 ? JSON.stringify(cls) : undefined
    const { data } = await documentsApi.list({
      domain: activeDomain.value,
      classifications: classificationStr,
      page: 1,
      size: 50,
    })
    siblings.value = data.data.filter((d: DocumentEntity) => d.id !== props.excludeId)
  } catch {
    siblings.value = []
  } finally {
    loading.value = false
  }
}

async function loadDocuments() {
  loading.value = true
  try {
    const { data } = await documentsApi.list({
      domain: activeDomain.value,
      page: page.value,
      size: PAGE_SIZE,
    })
    documents.value = data.data.filter((d: DocumentEntity) => d.id !== props.excludeId)
    totalPages.value = data.meta.totalPages
  } catch {
    documents.value = []
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  if (!searchQuery.value || searchQuery.value.length < 1) {
    documents.value = []
    return
  }
  activeTab.value = 'search'
  loading.value = true
  searchTimer = setTimeout(async () => {
    try {
      const { data } = await documentsApi.search({
        q: searchQuery.value,
        page: 1,
        size: PAGE_SIZE,
      })
      documents.value = data.data.filter((d: DocumentEntity) => d.id !== props.excludeId)
      totalPages.value = data.meta.totalPages
    } catch {
      documents.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

function handlePageChange(p: number) {
  page.value = p
  if (activeTab.value === 'all') loadDocuments()
}

function selectDoc(doc: DocumentEntity) {
  emit('select', doc)
}

const displayList = computed(() => {
  if (activeTab.value === 'siblings') return siblings.value
  return documents.value
})

function lifecycleType(lifecycle: string): string {
  if (lifecycle === 'ACTIVE') return 'success'
  if (lifecycle === 'DRAFT') return 'info'
  return 'danger'
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden">
    <!-- 검색 -->
    <div style="padding: 8px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0">
      <el-input
        v-model="searchQuery"
        placeholder="문서 검색..."
        clearable
        size="small"
        @input="handleSearch"
        @clear="activeTab = 'siblings'"
      />
    </div>

    <!-- 도메인 탭 -->
    <div style="padding: 4px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0; overflow-x: auto; white-space: nowrap">
      <el-radio-group v-model="activeDomain" size="small">
        <el-radio-button
          v-for="d in domains"
          :key="d.code"
          :value="d.code"
        >
          {{ d.displayName }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 서브 탭: 형제 | 전체 -->
    <div v-if="activeTab !== 'search'" style="padding: 4px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0">
      <el-radio-group v-model="activeTab" size="small">
        <el-radio-button value="siblings">
          형제 문서 (같은 분류)
        </el-radio-button>
        <el-radio-button value="all">
          전체 문서
        </el-radio-button>
      </el-radio-group>
    </div>
    <div v-else style="padding: 4px 12px; border-bottom: 1px solid #ebeef5; flex-shrink: 0; font-size: 12px; color: #909399">
      검색 결과
      <el-button text size="small" @click="activeTab = 'siblings'; searchQuery = ''">초기화</el-button>
    </div>

    <!-- 문서 목록 -->
    <div v-loading="loading" style="flex: 1; overflow: auto">
      <template v-if="displayList.length > 0">
        <div
          v-for="doc in displayList"
          :key="doc.id"
          style="padding: 8px 12px; border-bottom: 1px solid #f2f3f5; cursor: pointer; transition: background 0.15s"
          @mouseenter="($event.currentTarget as HTMLElement).style.background = '#f5f7fa'"
          @mouseleave="($event.currentTarget as HTMLElement).style.background = ''"
          @click="selectDoc(doc)"
        >
          <div style="display: flex; align-items: center; gap: 6px">
            <span style="font-size: 13px; font-weight: 500; color: #303133; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
              {{ doc.fileName ?? doc.docCode ?? '(제목 없음)' }}
            </span>
            <el-tag
              v-if="props.existingRelations?.has(doc.id)"
              size="small"
              type="info"
              style="flex-shrink: 0"
            >
              {{ props.existingRelations.get(doc.id) }}
            </el-tag>
            <el-tag size="small" :type="lifecycleType(doc.lifecycle)">
              {{ LIFECYCLE_LABELS[doc.lifecycle] ?? doc.lifecycle }}
            </el-tag>
          </div>
          <div style="font-size: 11px; color: #909399; margin-top: 2px">
            <span v-if="doc.docCode" style="margin-right: 8px">{{ doc.docCode }}</span>
            <span>{{ doc.domain }}</span>
            <template v-for="(value, key) in doc.classifications" :key="key">
              <span style="margin-left: 6px">{{ FACET_TYPE_LABELS[String(key)] ?? key }}: {{ value }}</span>
            </template>
          </div>
        </div>
      </template>
      <div v-else-if="!loading" style="padding: 40px; text-align: center; color: #909399; font-size: 13px">
        <template v-if="activeTab === 'siblings'">같은 분류의 문서가 없습니다</template>
        <template v-else-if="activeTab === 'search'">검색 결과가 없습니다</template>
        <template v-else>문서가 없습니다</template>
      </div>
    </div>

    <!-- 페이지네이션 (전체/검색 탭) -->
    <div v-if="activeTab !== 'siblings' && totalPages > 1" style="padding: 8px 12px; border-top: 1px solid #ebeef5; flex-shrink: 0; text-align: center">
      <el-pagination
        :current-page="page"
        :page-count="totalPages"
        layout="prev, pager, next"
        small
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>
