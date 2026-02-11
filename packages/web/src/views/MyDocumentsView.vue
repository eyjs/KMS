<template>
  <div class="my-documents">
    <el-page-header @back="$router.push('/')" style="margin-bottom: 16px">
      <template #content>내 문서함</template>
    </el-page-header>

    <!-- 통계 카드 -->
    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-number">{{ stats.total }}</div>
          <div class="stat-label">전체 문서</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card stat-warning" @click="filterOrphans = true">
          <div class="stat-number">{{ stats.orphan }}</div>
          <div class="stat-label">미배치</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card stat-success" @click="filterOrphans = false">
          <div class="stat-number">{{ stats.total - stats.orphan }}</div>
          <div class="stat-label">배치완료</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 필터 + 업로드 버튼 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
      <div>
        <el-radio-group v-model="filterOrphans" @change="loadDocuments(1)">
          <el-radio-button :value="null">전체</el-radio-button>
          <el-radio-button :value="true">미배치</el-radio-button>
          <el-radio-button :value="false">배치완료</el-radio-button>
        </el-radio-group>
      </div>
      <el-button type="primary" @click="showUpload = true">
        <el-icon><Upload /></el-icon>
        문서 업로드
      </el-button>
    </div>

    <!-- 문서 목록 -->
    <el-table :data="documents" v-loading="loading" stripe @row-click="goToDocument">
      <el-table-column prop="docCode" label="문서코드" width="160" />
      <el-table-column prop="fileName" label="파일명" min-width="200" />
      <el-table-column label="상태" width="100">
        <template #default="{ row }">
          <StatusTag type="lifecycle" :value="row.lifecycle" />
        </template>
      </el-table-column>
      <el-table-column label="보안등급" width="120">
        <template #default="{ row }">
          <el-tag size="small" :type="securityTagType(row.securityLevel)">
            {{ SECURITY_LEVEL_LABELS[row.securityLevel] || row.securityLevel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="배치" width="80" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.placementCount === 0" type="warning" size="small">미배치</el-tag>
          <span v-else>{{ row.placementCount }}개</span>
        </template>
      </el-table-column>
      <el-table-column label="업로드일" width="120">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="" width="80" align="center">
        <template #default="{ row }">
          <el-button
            v-if="row.placementCount === 0"
            size="small" type="primary" plain
            @click.stop="openPlacement(row)"
          >배치</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > pageSize"
      style="margin-top: 16px; justify-content: center"
      layout="prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="currentPage"
      @current-change="loadDocuments"
    />

    <!-- 업로드 다이얼로그 -->
    <UploadDialog v-model:visible="showUpload" @uploaded="onUploaded" />

    <!-- 배치 다이얼로그 -->
    <PlacementDialog
      v-model:visible="showPlacement"
      :document-id="placementDocId"
      @placed="onPlaced"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { documentsApi } from '@/api/documents'
import { SECURITY_LEVEL_LABELS } from '@kms/shared'
import StatusTag from '@/components/common/StatusTag.vue'
import UploadDialog from '@/components/domain/UploadDialog.vue'
import PlacementDialog from '@/components/document/PlacementDialog.vue'
import type { DocumentEntity } from '@kms/shared'

const router = useRouter()
const loading = ref(false)
const documents = ref<DocumentEntity[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20
const filterOrphans = ref<boolean | null>(null)
const showUpload = ref(false)
const showPlacement = ref(false)
const placementDocId = ref('')

const stats = ref({ total: 0, orphan: 0 })

function securityTagType(level: string) {
  const map: Record<string, string> = { PUBLIC: 'success', INTERNAL: '', CONFIDENTIAL: 'warning', SECRET: 'danger' }
  return map[level] ?? ''
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR')
}

async function loadDocuments(page = 1) {
  loading.value = true
  currentPage.value = page
  try {
    const res = await documentsApi.getMyDocuments(page, pageSize, filterOrphans.value)
    documents.value = res.data.data
    total.value = res.data.meta.total
  } catch {
    ElMessage.error('문서 목록 로드 실패')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const [myRes, orphanRes] = await Promise.all([
      documentsApi.getMyDocuments(1, 1),
      documentsApi.getOrphans(1, 1),
    ])
    stats.value.total = myRes.data.meta.total
    stats.value.orphan = orphanRes.data.meta.total
  } catch {
    // 무시
  }
}

function goToDocument(row: DocumentEntity) {
  router.push(`/d/_/doc/${row.id}`)
}

function openPlacement(row: DocumentEntity) {
  placementDocId.value = row.id
  showPlacement.value = true
}

function onUploaded() {
  showUpload.value = false
  loadDocuments(1)
  loadStats()
}

function onPlaced() {
  showPlacement.value = false
  loadDocuments(currentPage.value)
  loadStats()
}

onMounted(() => {
  loadDocuments()
  loadStats()
})
</script>

<style scoped>
.my-documents {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.stat-card {
  text-align: center;
  cursor: pointer;
}
.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: var(--el-color-primary);
}
.stat-warning .stat-number {
  color: var(--el-color-warning);
}
.stat-success .stat-number {
  color: var(--el-color-success);
}
.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
