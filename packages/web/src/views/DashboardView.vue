<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDomainStore } from '@/stores/domain'
import { documentsApi } from '@/api/documents'
import type { DocumentStats, RecentActivity, IssueCounts } from '@/api/documents'
import type { DomainMasterEntity, DocumentEntity } from '@kms/shared'

const router = useRouter()
const domainStore = useDomainStore()

const stats = ref<DocumentStats | null>(null)
const recentActivities = ref<RecentActivity[]>([])
const loading = ref(true)

const ACTION_LABELS: Record<string, string> = {
  CREATE: '업로드',
  UPDATE: '수정',
  LIFECYCLE_CHANGE: '상태 변경',
  DELETE: '삭제',
}

interface FlatDomainRow {
  domain: string
  displayName: string
  total: number
  active: number
  draft: number
  deprecated: number
  warning: number
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
        active: s?.active ?? 0,
        draft: s?.draft ?? 0,
        deprecated: s?.deprecated ?? 0,
        warning: s?.warning ?? 0,
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
    // 트리 미로딩 시 flat fallback
    for (const s of stats.value.byDomain) {
      result.push({ ...s, depth: 0 })
    }
  }
  return result
})

// ============================================================
// 조치 필요 문서
// ============================================================

const ISSUE_TABS = [
  { key: 'warning', label: '경고' },
  { key: 'expired', label: '만료' },
  { key: 'no_file', label: '파일없음' },
  { key: 'stale_draft', label: 'DRAFT 장기' },
] as const

const activeIssueTab = ref('warning')
const issueCounts = ref<IssueCounts>({ warning: 0, expired: 0, noFile: 0, staleDraft: 0 })
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
    default: return 0
  }
}

const totalIssues = computed(() =>
  issueCounts.value.warning + issueCounts.value.expired + issueCounts.value.noFile + issueCounts.value.staleDraft,
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
  await loadIssues()
}

async function handleIssuePageChange(page: number) {
  issuePage.value = page
  await loadIssues()
}

function goToDocument(doc: DocumentEntity) {
  router.push(`/d/${doc.domain}/doc/${doc.id}`)
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
    stats.value = {
      total: 0,
      active: 0,
      draft: 0,
      deprecated: 0,
      freshnessWarning: 0,
      byDomain: [],
    }
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
  <div v-loading="loading" style="height: 100%; overflow-y: auto">
    <h2 style="margin: 0 0 12px; font-size: 20px">KMS 문서관리 프레임워크</h2>

    <!-- 통계 카드 -->
    <el-row :gutter="12" style="margin-bottom: 16px">
      <el-col :span="6">
        <el-card shadow="never" :body-style="{ padding: '16px' }">
          <div style="font-size: 13px; color: #909399">전체 문서</div>
          <div style="font-size: 28px; font-weight: 700; color: #303133; margin-top: 4px">
            {{ stats?.total ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" :body-style="{ padding: '16px' }">
          <div style="font-size: 13px; color: #909399">ACTIVE</div>
          <div style="font-size: 28px; font-weight: 700; color: #67c23a; margin-top: 4px">
            {{ stats?.active ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" :body-style="{ padding: '16px' }">
          <div style="font-size: 13px; color: #909399">DRAFT</div>
          <div style="font-size: 28px; font-weight: 700; color: #909399; margin-top: 4px">
            {{ stats?.draft ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" :body-style="{ padding: '16px' }">
          <div style="font-size: 13px; color: #909399">조치 필요</div>
          <div style="font-size: 28px; font-weight: 700; color: #f56c6c; margin-top: 4px">
            {{ totalIssues }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 조치 필요 문서 -->
    <el-card v-if="totalIssues > 0" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">조치 필요 문서</span>
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
      <el-table
        v-loading="issueLoading"
        :data="issueDocuments"
        size="small"
        :header-cell-style="{ background: '#fafafa' }"
      >
        <el-table-column label="파일명" min-width="200">
          <template #default="{ row }">
            <span style="color: #303133">{{ row.fileName ?? row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="domain" label="도메인" width="120" />
        <el-table-column label="상태" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.lifecycle === 'ACTIVE' ? 'success' : row.lifecycle === 'DRAFT' ? 'info' : 'danger'"
              size="small"
            >
              {{ row.lifecycle }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="최종수정" width="100" align="center">
          <template #default="{ row }">
            {{ formatTimeAgo(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="" width="60" align="center">
          <template #default="{ row }">
            <el-button text size="small" type="primary" @click="goToDocument(row)">
              이동
            </el-button>
          </template>
        </el-table-column>
      </el-table>
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
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">도메인별 문서 현황</span>
      </template>
      <el-table
        :data="byDomainFlat"
        size="small"
        style="cursor: pointer"
        @row-click="handleDomainRowClick"
        :header-cell-style="{ background: '#fafafa' }"
      >
        <el-table-column label="도메인" min-width="160">
          <template #default="{ row }">
            <span :style="{ paddingLeft: row.depth * 20 + 'px' }">
              {{ row.displayName }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="total" label="전체" width="80" align="center" />
        <el-table-column label="ACTIVE" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.active > 0" type="success" size="small">{{ row.active }}</el-tag>
            <span v-else style="color: #c0c4cc">0</span>
          </template>
        </el-table-column>
        <el-table-column label="DRAFT" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.draft > 0" type="info" size="small">{{ row.draft }}</el-tag>
            <span v-else style="color: #c0c4cc">0</span>
          </template>
        </el-table-column>
        <el-table-column label="DEPRECATED" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.deprecated > 0" type="danger" size="small">{{ row.deprecated }}</el-tag>
            <span v-else style="color: #c0c4cc">0</span>
          </template>
        </el-table-column>
        <el-table-column label="경고" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.warning > 0" type="warning" size="small">{{ row.warning }}</el-tag>
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

    <!-- 최근 활동 -->
    <el-card shadow="never">
      <template #header>
        <span style="font-weight: 600">최근 활동</span>
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
          <el-tag size="small">{{ ACTION_LABELS[activity.action] ?? activity.action }}</el-tag>
          <el-tag size="small" type="info">{{ activity.domain }}</el-tag>
        </div>
      </div>
      <el-empty v-else description="최근 활동이 없습니다" />
    </el-card>
  </div>
</template>
