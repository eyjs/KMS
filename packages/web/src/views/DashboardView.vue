<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import { useAuthStore } from '@/stores/auth'
import type { DomainMasterEntity } from '@kms/shared'

const auth = useAuthStore()
const domains = ref<DomainMasterEntity[]>([])
const stats = ref<Record<string, { total: number; active: number; draft: number; deprecated: number }>>({})
const loading = ref(true)

const SECURITY_LABEL: Record<string, string> = {
  PUBLIC: '공개',
  INTERNAL: '사내용',
  CONFIDENTIAL: '대외비(2급)',
  SECRET: '기밀(1급)',
}

onMounted(async () => {
  try {
    const { data } = await taxonomyApi.getDomains()
    domains.value = data

    for (const d of data) {
      const [all, active, draft] = await Promise.all([
        documentsApi.list({ domain: d.code, size: 1 }),
        documentsApi.list({ domain: d.code, lifecycle: 'ACTIVE', size: 1 }),
        documentsApi.list({ domain: d.code, lifecycle: 'DRAFT', size: 1 }),
      ])
      stats.value[d.code] = {
        total: all.data.meta.total,
        active: active.data.meta.total,
        draft: draft.data.meta.total,
        deprecated: all.data.meta.total - active.data.meta.total - draft.data.meta.total,
      }
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h2>대시보드</h2>
    <p style="color: #909399">
      접근 권한:
      <el-tag v-if="auth.canAccessSecurityLevel('SECRET')" type="danger" size="small">기밀(1급)</el-tag>
      <el-tag v-if="auth.canAccessSecurityLevel('CONFIDENTIAL')" type="warning" size="small">대외비(2급)</el-tag>
      <el-tag v-if="auth.canAccessSecurityLevel('INTERNAL')" size="small">사내용</el-tag>
      <el-tag v-if="auth.canAccessSecurityLevel('PUBLIC')" type="success" size="small">공개</el-tag>
    </p>

    <el-row :gutter="20" v-loading="loading">
      <el-col :span="8" v-for="d in domains" :key="d.code">
        <el-card shadow="hover" style="margin-bottom: 20px">
          <template #header>
            <strong>{{ d.displayName }}</strong>
            <el-tag size="small" style="margin-left: 8px">{{ d.code }}</el-tag>
          </template>
          <div v-if="stats[d.code]">
            <p>전체: {{ stats[d.code].total }}건</p>
            <p>ACTIVE: <el-tag type="success" size="small">{{ stats[d.code].active }}</el-tag></p>
            <p>DRAFT: <el-tag type="info" size="small">{{ stats[d.code].draft }}</el-tag></p>
            <p>DEPRECATED: <el-tag type="danger" size="small">{{ stats[d.code].deprecated }}</el-tag></p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
