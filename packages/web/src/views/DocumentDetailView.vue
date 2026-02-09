<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { relationsApi } from '@/api/relations'
import { useAuthStore } from '@/stores/auth'
import { LIFECYCLE_TRANSITIONS } from '@kms/shared'
import type { DocumentEntity, Lifecycle } from '@kms/shared'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const doc = ref<DocumentEntity | null>(null)
const relations = ref<{ asSource: unknown[]; asTarget: unknown[] }>({ asSource: [], asTarget: [] })
const loading = ref(true)

const SECURITY_LABELS: Record<string, string> = {
  PUBLIC: '공개',
  INTERNAL: '사내용',
  CONFIDENTIAL: '대외비(2급)',
  SECRET: '기밀(1급)',
}

const id = route.params.id as string

onMounted(async () => {
  try {
    const [docRes, relRes] = await Promise.all([
      documentsApi.get(id),
      relationsApi.getByDocument(id),
    ])
    doc.value = docRes.data
    relations.value = relRes.data
  } catch {
    ElMessage.error('문서를 불러올 수 없습니다')
    router.push('/documents')
  } finally {
    loading.value = false
  }
})

async function handleTransition(lifecycle: Lifecycle) {
  if (!doc.value) return
  try {
    await ElMessageBox.confirm(
      `${doc.value.lifecycle} → ${lifecycle}로 전환하시겠습니까?`,
      '라이프사이클 전환',
    )
    const { data } = await documentsApi.transitionLifecycle(id, lifecycle)
    doc.value = data
    ElMessage.success('전환되었습니다')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('전환에 실패했습니다')
  }
}

async function handleDelete() {
  if (!doc.value) return
  try {
    await ElMessageBox.confirm('정말 삭제하시겠습니까?', '문서 삭제', { type: 'warning' })
    await documentsApi.delete(id)
    ElMessage.success('삭제되었습니다')
    router.push('/documents')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('삭제에 실패했습니다')
  }
}

async function handleDownload() {
  try {
    const { data } = await documentsApi.downloadFile(id)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.value?.fileName ?? 'download'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('다운로드에 실패했습니다')
  }
}

function getNextLifecycles(current: string): string[] {
  return LIFECYCLE_TRANSITIONS[current as Lifecycle] ?? []
}
</script>

<template>
  <div v-loading="loading">
    <el-page-header @back="router.push('/documents')">
      <template #content>
        {{ doc?.fileName ?? '문서 상세' }}
      </template>
    </el-page-header>

    <div v-if="doc" style="margin-top: 20px">
      <!-- 기본 정보 -->
      <el-card>
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span>문서 정보</span>
            <div>
              <el-button size="small" @click="handleDownload">다운로드</el-button>
              <el-button
                v-for="next in getNextLifecycles(doc.lifecycle)"
                :key="next"
                size="small"
                type="primary"
                @click="handleTransition(next as Lifecycle)"
              >
                → {{ next }}
              </el-button>
              <el-button
                v-if="auth.hasMinRole('TEAM_LEAD')"
                size="small"
                type="danger"
                @click="handleDelete"
              >
                삭제
              </el-button>
            </div>
          </div>
        </template>

        <el-descriptions :column="2" border>
          <el-descriptions-item label="도메인">{{ doc.domain }}</el-descriptions-item>
          <el-descriptions-item label="상태">
            <el-tag :type="doc.lifecycle === 'ACTIVE' ? 'success' : doc.lifecycle === 'DRAFT' ? 'info' : 'danger'" size="small">
              {{ doc.lifecycle }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="보안등급">
            <el-tag :type="doc.securityLevel === 'SECRET' ? 'danger' : doc.securityLevel === 'CONFIDENTIAL' ? 'warning' : ''" size="small">
              {{ SECURITY_LABELS[doc.securityLevel] ?? doc.securityLevel }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="파일형식">{{ doc.fileType }}</el-descriptions-item>
          <el-descriptions-item label="파일크기">{{ (doc.fileSize / 1024).toFixed(1) }} KB</el-descriptions-item>
          <el-descriptions-item label="버전">v{{ doc.versionMajor }}.{{ doc.versionMinor }}</el-descriptions-item>
          <el-descriptions-item label="신선도">
            <el-tag v-if="doc.freshness" :type="doc.freshness === 'FRESH' ? 'success' : doc.freshness === 'WARNING' ? 'warning' : 'danger'" size="small">
              {{ doc.freshness }}
            </el-tag>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="생성일">{{ new Date(doc.createdAt).toLocaleString('ko-KR') }}</el-descriptions-item>
        </el-descriptions>

        <!-- 분류 -->
        <h4 style="margin-top: 20px">분류</h4>
        <el-descriptions :column="3" border>
          <el-descriptions-item
            v-for="(value, key) in doc.classifications"
            :key="key"
            :label="String(key)"
          >
            {{ value }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 관계 -->
      <el-card style="margin-top: 20px">
        <template #header>관계</template>
        <div v-if="relations.asSource.length === 0 && relations.asTarget.length === 0">
          <el-empty description="관계가 없습니다" />
        </div>
        <div v-else>
          <p>출발 관계: {{ relations.asSource.length }}건</p>
          <p>대상 관계: {{ relations.asTarget.length }}건</p>
        </div>
      </el-card>
    </div>
  </div>
</template>
