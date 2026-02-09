<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import type { DocumentStats, RecentActivity } from '@/api/documents'

const router = useRouter()

const stats = ref<DocumentStats | null>(null)
const recentActivities = ref<RecentActivity[]>([])
const loading = ref(true)

const ACTION_LABELS: Record<string, string> = {
  CREATE: '업로드',
  UPDATE: '수정',
  LIFECYCLE_CHANGE: '상태 변경',
  DELETE: '삭제',
}

onMounted(async () => {
  try {
    const [statsRes, recentRes] = await Promise.all([
      documentsApi.getStats(),
      documentsApi.getRecent(10),
    ])
    stats.value = statsRes.data
    recentActivities.value = recentRes.data
  } catch {
    // stats/recent API가 아직 없을 수 있으므로 fallback
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
  <div v-loading="loading">
    <h2 style="margin: 0 0 20px; font-size: 22px">KMS 문서관리 프레임워크</h2>

    <!-- 통계 카드 -->
    <el-row :gutter="16" style="margin-bottom: 24px">
      <el-col :span="6">
        <el-card shadow="never" :body-style="{ padding: '20px' }">
          <div style="font-size: 13px; color: #909399">전체 문서</div>
          <div style="font-size: 28px; font-weight: 700; color: #303133; margin-top: 4px">
            {{ stats?.total ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" :body-style="{ padding: '20px' }">
          <div style="font-size: 13px; color: #909399">ACTIVE</div>
          <div style="font-size: 28px; font-weight: 700; color: #67c23a; margin-top: 4px">
            {{ stats?.active ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" :body-style="{ padding: '20px' }">
          <div style="font-size: 13px; color: #909399">DRAFT</div>
          <div style="font-size: 28px; font-weight: 700; color: #909399; margin-top: 4px">
            {{ stats?.draft ?? 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" :body-style="{ padding: '20px' }">
          <div style="font-size: 13px; color: #909399">신선도 경고</div>
          <div style="font-size: 28px; font-weight: 700; color: #e6a23c; margin-top: 4px">
            {{ stats?.freshnessWarning ?? 0 }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 도메인별 현황 -->
    <el-card shadow="never" style="margin-bottom: 24px">
      <template #header>
        <span style="font-weight: 600">도메인별 문서 현황</span>
      </template>
      <el-table
        :data="stats?.byDomain ?? []"
        size="small"
        style="cursor: pointer"
        @row-click="handleDomainRowClick"
        :header-cell-style="{ background: '#fafafa' }"
      >
        <el-table-column prop="displayName" label="도메인" min-width="160" />
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
