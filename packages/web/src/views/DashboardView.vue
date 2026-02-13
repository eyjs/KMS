<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useDomainStore } from '@/stores/domain'
import { documentsApi } from '@/api/documents'
import type { DocumentStats, RecentActivity, IssueCounts } from '@/api/documents'
import type { DomainMasterEntity, DocumentEntity } from '@kms/shared'
import { ACTION_LABELS, ACTION_TAG_TYPES } from '@kms/shared'
import { useRecentDocs } from '@/composables/useRecentDocs'
import StatusTag from '@/components/common/StatusTag.vue'

const router = useRouter()
const route = useRoute()
const domainStore = useDomainStore()
const { recentDocs } = useRecentDocs()

const stats = ref<DocumentStats | null>(null)
const recentActivities = ref<RecentActivity[]>([])
const loading = ref(true)
const errorState = ref(false)

interface FlatDomainRow {
  domain: string
  displayName: string
  total: number
  depth: number
}

// byDomain 통계를 트리 순서 + depth로 변환
const byDomainFlat = computed<FlatDomainRow[]>(() => {
  if (!stats.value?.byDomain?.length) return []
  const statsMap = new Map(stats.value.byDomain.map((s) => [s.domain, s]))
  const result: FlatDomainRow[] = []

  function walk(nodes: DomainMasterEntity[], depth: number) {
    for (const node of nodes) {
      const s = statsMap.get(node.code)
      result.push({
        domain: node.code,
        displayName: node.displayName,
        total: s?.total ?? 0,
        depth,
      })
      if (node.children?.length) {
        walk(node.children, depth + 1)
      }
    }
  }

  if (domainStore.domainTree.length) {
    walk(domainStore.domainTree, 0)
  } else {
    for (const s of stats.value.byDomain) {
      result.push({ domain: s.domain, displayName: s.displayName, total: s.total, depth: 0 })
    }
  }
  return result
})

// ============================================================
// 조치 필요 문서
// ============================================================

const ISSUE_TABS = [
  { key: 'warning', label: '경고', emptyText: '신선도 경고 문서가 없습니다', ctaLabel: '검토', ctaType: 'warning' as const },
  { key: 'expired', label: '만료', emptyText: '만료된 문서가 없습니다', ctaLabel: '갱신', ctaType: 'danger' as const },
  { key: 'no_file', label: '파일없음', emptyText: '파일 미첨부 문서가 없습니다', ctaLabel: '파일 첨부', ctaType: 'primary' as const },
  { key: 'stale_draft', label: '임시저장 장기', emptyText: '장기 임시저장 문서가 없습니다', ctaLabel: '활성화', ctaType: 'success' as const },
  { key: 'long_orphan', label: '장기 미배치', emptyText: '장기 미배치 문서가 없습니다', ctaLabel: '배치', ctaType: 'warning' as const },
  { key: 'duplicate_name', label: '파일명 중복', emptyText: '파일명 중복 문서가 없습니다', ctaLabel: '확인', ctaType: 'danger' as const },
] as const

const validIssueKeys = ISSUE_TABS.map((t) => t.key) as readonly string[]
const initialTab = validIssueKeys.includes(route.query.issue as string) ? (route.query.issue as string) : 'warning'
const activeIssueTab = ref(initialTab)
const issueCounts = ref<IssueCounts>({ warning: 0, expired: 0, noFile: 0, staleDraft: 0, longOrphan: 0, duplicateName: 0 })
const issueDocuments = ref<DocumentEntity[]>([])
const issueLoading = ref(false)
const issuePage = ref(1)
const issueTotal = ref(0)
const ISSUE_PAGE_SIZE = 10

function getIssueCount(key: string): number {
  switch (key) {
    case 'warning': return issueCounts.value.warning
    case 'expired': return issueCounts.value.expired
    case 'no_file': return issueCounts.value.noFile
    case 'stale_draft': return issueCounts.value.staleDraft
    case 'long_orphan': return issueCounts.value.longOrphan
    case 'duplicate_name': return issueCounts.value.duplicateName
    default: return 0
  }
}

const totalIssues = computed(() =>
  issueCounts.value.warning + issueCounts.value.expired + issueCounts.value.noFile
  + issueCounts.value.staleDraft + issueCounts.value.longOrphan + issueCounts.value.duplicateName,
)

const currentTab = computed(() =>
  ISSUE_TABS.find((t) => t.key === activeIssueTab.value) ?? ISSUE_TABS[0],
)

async function loadIssues() {
  issueLoading.value = true
  try {
    const { data } = await documentsApi.getIssues(activeIssueTab.value, issuePage.value, ISSUE_PAGE_SIZE)
    issueDocuments.value = data.data
    issueTotal.value = data.meta.total
  } catch {
    issueDocuments.value = []
    issueTotal.value = 0
  } finally {
    issueLoading.value = false
  }
}

async function handleIssueTabChange() {
  issuePage.value = 1
  router.replace({ query: { ...route.query, issue: activeIssueTab.value } })
  await loadIssues()
}

async function handleIssuePageChange(page: number) {
  issuePage.value = page
  await loadIssues()
}

function goToDocument(doc: DocumentEntity) {
  // 배치 정보가 있으면 해당 도메인 경로, 없으면 범용 경로
  const domainCode = doc.placements?.[0]?.domainCode ?? '_'
  router.push(`/d/${domainCode}/doc/${doc.id}`)
}

// ============================================================
// 통계 카드 클릭
// ============================================================

function handleReload() {
  globalThis.location.reload()
}

function handleStatClick(type: 'total' | 'active' | 'draft' | 'deprecated' | 'orphan' | 'issues') {
  if (type === 'issues') {
    const el = document.getElementById('issue-section')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
    return
  }
  const query: Record<string, string> = {}
  if (type === 'active') query.lifecycle = 'ACTIVE'
  else if (type === 'draft') query.lifecycle = 'DRAFT'
  else if (type === 'deprecated') query.lifecycle = 'DEPRECATED'
  else if (type === 'orphan') query.orphan = 'true'
  router.push({ path: '/search', query })
}

// ============================================================
// 빠른 작업
// ============================================================

function goToSearch() {
  router.push('/search')
}

function goToUpload() {
  // 첫 번째 도메인 워크스페이스로 이동 (업로드 다이얼로그는 워크스페이스에서 열림)
  const firstDomain = domainStore.domainsFlat[0]
  if (firstDomain) {
    router.push(`/d/${firstDomain.code}`)
  } else {
    ElMessage.info('먼저 도메인을 생성해주세요')
  }
}

onMounted(async () => {
  try {
    const [, statsRes, recentRes, issueCountsRes] = await Promise.all([
      domainStore.loadDomains(),
      documentsApi.getStats(),
      documentsApi.getRecent(10),
      documentsApi.getIssueCounts(),
    ])
    stats.value = statsRes.data
    recentActivities.value = recentRes.data
    issueCounts.value = issueCountsRes.data
    await loadIssues()
  } catch {
    errorState.value = true
    stats.value = {
      total: 0,
      active: 0,
      draft: 0,
      deprecated: 0,
      orphan: 0,
      byDomain: [],
    }
    ElMessage.error('대시보드를 불러오는 중 오류가 발생했습니다')
  } finally {
    loading.value = false
  }
})

function goToDomain(domainCode: string) {
  router.push(`/d/${domainCode}`)
}

function handleDomainRowClick(row: { domain: string }) {
  goToDomain(row.domain)
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}
</script>

<template>
  <div v-loading="loading" class="dashboard-view">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px">
      <h2 style="margin: 0; font-size: 18px">KMS 문서관리 프레임워크</h2>
      <div style="display: flex; gap: 8px">
        <el-button size="small" @click="goToSearch">검색</el-button>
        <el-button type="primary" size="small" @click="goToUpload">문서 업로드</el-button>
      </div>
    </div>

    <!-- 에러 배너 -->
    <el-alert
      v-if="errorState"
      title="대시보드 데이터를 불러오지 못했습니다"
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 10px"
    >
      <template #default>
        <el-button size="small" type="primary" @click="handleReload">다시 시도</el-button>
      </template>
    </el-alert>

    <!-- 통계 카드 -->
    <el-row :gutter="10" style="margin-bottom: 10px">
      <el-col :span="5">
        <el-card shadow="never" :body-style="{ padding: '12px 16px', cursor: 'pointer' }" @click="handleStatClick('total')">
          <div style="font-size: 12px; color: #909399">전체 문서</div>
          <div style="font-size: 24px; font-weight: 700; color: #303133; margin-top: 2px">
            {{ stats?.total ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="5">
        <el-card shadow="never" :body-style="{ padding: '12px 16px', cursor: 'pointer' }" @click="handleStatClick('active')">
          <div style="font-size: 12px; color: #909399">사용중</div>
          <div style="font-size: 24px; font-weight: 700; color: #67c23a; margin-top: 2px">
            {{ stats?.active ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="5">
        <el-card shadow="never" :body-style="{ padding: '12px 16px', cursor: 'pointer' }" @click="handleStatClick('draft')">
          <div style="font-size: 12px; color: #909399">임시저장</div>
          <div style="font-size: 24px; font-weight: 700; color: #909399; margin-top: 2px">
            {{ stats?.draft ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="5">
        <el-card shadow="never" :body-style="{ padding: '12px 16px', cursor: 'pointer' }" @click="handleStatClick('deprecated')">
          <div style="font-size: 12px; color: #909399">만료</div>
          <div style="font-size: 24px; font-weight: 700; color: #f56c6c; margin-top: 2px">
            {{ stats?.deprecated ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="never" :body-style="{ padding: '12px 16px', cursor: 'pointer' }" @click="handleStatClick('orphan')">
          <div style="font-size: 12px; color: #909399">미배치</div>
          <div style="font-size: 24px; font-weight: 700; color: #e6a23c; margin-top: 2px">
            {{ stats?.orphan ?? 0 }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 조치 필요 문서 -->
    <el-card v-if="totalIssues > 0" id="issue-section" shadow="never" style="margin-bottom: 10px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: 600; font-size: 14px">조치 필요 문서</span>
          <el-tag type="danger" size="small">{{ totalIssues }}건</el-tag>
        </div>
      </template>
      <el-tabs v-model="activeIssueTab" @tab-change="handleIssueTabChange">
        <el-tab-pane
          v-for="tab in ISSUE_TABS"
          :key="tab.key"
          :name="tab.key"
        >
          <template #label>
            {{ tab.label }}
            <el-badge
              v-if="getIssueCount(tab.key) > 0"
              :value="getIssueCount(tab.key)"
              :type="tab.key === 'expired' ? 'danger' : 'warning'"
              style="margin-left: 4px"
            />
          </template>
        </el-tab-pane>
      </el-tabs>
      <div v-loading="issueLoading">
        <el-table
          v-if="issueDocuments.length > 0"
          :data="issueDocuments"
          size="small"
          :header-cell-style="{ background: '#fafafa' }"
        >
          <el-table-column label="파일명" min-width="200">
            <template #default="{ row }">
              <span style="color: #303133">{{ row.fileName ?? row.id }}</span>
            </template>
          </el-table-column>
          <el-table-column label="배치 도메인" width="140">
            <template #default="{ row }">
              <template v-if="row.placements?.length">
                <el-tag
                  v-for="p in row.placements.slice(0, 2)"
                  :key="p.id"
                  size="small"
                  type="info"
                  style="margin-right: 4px"
                >
                  {{ p.domainName ?? p.domainCode }}
                </el-tag>
                <span v-if="row.placements.length > 2" style="color: #909399; font-size: 11px">
                  +{{ row.placements.length - 2 }}
                </span>
              </template>
              <span v-else style="color: #e6a23c; font-size: 12px">미배치</span>
            </template>
          </el-table-column>
          <el-table-column label="상태" width="100" align="center">
            <template #default="{ row }">
              <StatusTag type="lifecycle" :value="row.lifecycle" />
            </template>
          </el-table-column>
          <el-table-column label="최종수정" width="100" align="center">
            <template #default="{ row }">
              {{ formatTimeAgo(row.updatedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="" width="90" align="center">
            <template #default="{ row }">
              <el-button
                size="small"
                :type="currentTab.ctaType"
                @click="goToDocument(row)"
              >
                {{ currentTab.ctaLabel }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty
          v-if="!issueLoading && issueDocuments.length === 0"
          :description="currentTab.emptyText"
          :image-size="60"
        />
      </div>
      <div v-if="issueTotal > ISSUE_PAGE_SIZE" style="margin-top: 12px; text-align: right">
        <el-pagination
          small
          layout="prev, pager, next"
          :total="issueTotal"
          :page-size="ISSUE_PAGE_SIZE"
          :current-page="issuePage"
          @current-change="handleIssuePageChange"
        />
      </div>
    </el-card>

    <!-- 도메인별 현황 -->
    <el-card shadow="never" style="margin-bottom: 10px">
      <template #header>
        <span style="font-weight: 600; font-size: 14px">도메인별 문서 현황</span>
      </template>
      <el-table
        :data="byDomainFlat"
        size="small"
        style="cursor: pointer"
        @row-click="handleDomainRowClick"
        :header-cell-style="{ background: '#fafafa' }"
      >
        <el-table-column label="도메인" min-width="200">
          <template #default="{ row }">
            <span :style="{ paddingLeft: row.depth * 20 + 'px' }">
              {{ row.displayName }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="코드" width="120">
          <template #default="{ row }">
            <span style="font-family: monospace; color: #909399; font-size: 12px">{{ row.domain }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total" label="문서 수" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.total > 0" size="small">{{ row.total }}</el-tag>
            <span v-else style="color: #c0c4cc">0</span>
          </template>
        </el-table-column>
        <el-table-column width="40" align="center">
          <template #default>
            <span style="color: #c0c4cc">→</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && (stats?.byDomain ?? []).length === 0" description="도메인이 없습니다" />
    </el-card>

    <!-- 최근 열람 -->
    <el-card v-if="recentDocs.length > 0" shadow="never" style="margin-bottom: 10px">
      <template #header>
        <span style="font-weight: 600; font-size: 14px">최근 열람 문서</span>
      </template>
      <div>
        <div
          v-for="entry in recentDocs.slice(0, 10)"
          :key="entry.id"
          style="display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f2f3f5; font-size: 13px; cursor: pointer"
          @click="router.push(`/d/_/doc/${entry.id}`)"
        >
          <span v-if="entry.docCode" style="font-family: monospace; color: #409eff; width: 130px; flex-shrink: 0">
            {{ entry.docCode }}
          </span>
          <span style="color: #303133; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
            {{ entry.fileName ?? '(메타데이터만)' }}
          </span>
          <span style="color: #c0c4cc; font-size: 12px; flex-shrink: 0">
            {{ formatTimeAgo(entry.visitedAt) }}
          </span>
        </div>
      </div>
    </el-card>

    <!-- 최근 활동 -->
    <el-card shadow="never">
      <template #header>
        <span style="font-weight: 600; font-size: 14px">최근 활동</span>
      </template>
      <div v-if="recentActivities.length > 0">
        <div
          v-for="activity in recentActivities"
          :key="activity.id"
          style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f2f3f5; font-size: 13px"
        >
          <span style="color: #909399; width: 80px; flex-shrink: 0">
            {{ formatTimeAgo(activity.createdAt) }}
          </span>
          <span style="color: #606266; width: 60px; flex-shrink: 0">
            {{ activity.userName ?? '시스템' }}
          </span>
          <span style="color: #303133; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
            {{ activity.fileName }}
          </span>
          <el-tag size="small" :type="ACTION_TAG_TYPES[activity.action] ?? 'info'">{{ ACTION_LABELS[activity.action] ?? activity.action }}</el-tag>
        </div>
      </div>
      <el-empty v-else description="최근 활동이 없습니다" />
    </el-card>
  </div>
</template>

<style scoped>
.dashboard-view {
  height: 100%;
  overflow-y: auto;
}
.dashboard-view :deep(.el-card__header) {
  padding: 10px 16px;
}
.dashboard-view :deep(.el-card__body) {
  padding: 12px 16px;
}
</style>
