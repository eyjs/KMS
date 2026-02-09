<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { client } from '@/api/client'
import { ElMessage } from 'element-plus'
import type { UserRole } from '@kms/shared'

const auth = useAuthStore()

const newUser = ref({ email: '', password: '', name: '', role: 'EMPLOYEE' as UserRole })
const newApiKey = ref({ name: '', role: 'EXTERNAL' as UserRole })
const generatedKey = ref<string | null>(null)
const loading = ref(false)

const ROLE_OPTIONS = [
  { value: 'EXTERNAL', label: '외부업체' },
  { value: 'EMPLOYEE', label: '직원' },
  { value: 'TEAM_LEAD', label: '팀장' },
  { value: 'EXECUTIVE', label: '임원' },
  { value: 'ADMIN', label: '관리자' },
]

async function createUser() {
  if (!newUser.value.email || !newUser.value.password || !newUser.value.name) {
    ElMessage.warning('모든 필드를 입력하세요')
    return
  }
  loading.value = true
  try {
    await client.post('/auth/users', newUser.value)
    ElMessage.success('사용자가 생성되었습니다')
    newUser.value = { email: '', password: '', name: '', role: 'EMPLOYEE' }
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '생성에 실패했습니다'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

async function createApiKey() {
  if (!newApiKey.value.name) {
    ElMessage.warning('API Key 이름을 입력하세요')
    return
  }
  loading.value = true
  try {
    const { data } = await client.post('/auth/api-keys', newApiKey.value)
    generatedKey.value = data.key
    ElMessage.success('API Key가 생성되었습니다. 이 키는 다시 볼 수 없습니다.')
    newApiKey.value.name = ''
  } catch {
    ElMessage.error('API Key 생성에 실패했습니다')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h2 style="margin: 0 0 20px; font-size: 22px">사용자 관리</h2>

    <div style="display: flex; gap: 20px">
      <!-- 사용자 생성 -->
      <el-card shadow="never" style="flex: 1">
        <template #header>
          <span style="font-weight: 600">사용자 생성</span>
        </template>
        <el-form label-width="80px" style="max-width: 400px">
          <el-form-item label="이메일">
            <el-input v-model="newUser.email" type="email" placeholder="user@company.com" />
          </el-form-item>
          <el-form-item label="비밀번호">
            <el-input v-model="newUser.password" type="password" show-password />
          </el-form-item>
          <el-form-item label="이름">
            <el-input v-model="newUser.name" placeholder="홍길동" />
          </el-form-item>
          <el-form-item label="역할">
            <el-select v-model="newUser.role" style="width: 100%">
              <el-option v-for="r in ROLE_OPTIONS" :key="r.value" :label="r.label" :value="r.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="createUser">생성</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- API Key 생성 -->
      <el-card shadow="never" style="flex: 1">
        <template #header>
          <span style="font-weight: 600">API Key 생성</span>
        </template>
        <el-form label-width="80px" style="max-width: 400px">
          <el-form-item label="이름">
            <el-input v-model="newApiKey.name" placeholder="외부업체명 등" />
          </el-form-item>
          <el-form-item label="역할">
            <el-select v-model="newApiKey.role" style="width: 100%">
              <el-option v-for="r in ROLE_OPTIONS" :key="r.value" :label="r.label" :value="r.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="createApiKey">생성</el-button>
          </el-form-item>
        </el-form>

        <el-alert
          v-if="generatedKey"
          :title="generatedKey"
          type="success"
          description="이 API Key는 다시 확인할 수 없습니다. 지금 복사해 주세요."
          :closable="false"
          show-icon
          style="margin-top: 16px"
        />
      </el-card>
    </div>
  </div>
</template>
