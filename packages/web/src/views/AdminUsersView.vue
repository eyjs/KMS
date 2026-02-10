<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { client } from '@/api/client'
import { ElMessage } from 'element-plus'
import type { UserRole } from '@kms/shared'

interface UserItem {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string
}

const users = ref<UserItem[]>([])
const usersLoading = ref(false)

const newUser = ref({ email: '', password: '', name: '', role: 'EDITOR' as UserRole })
const newApiKey = ref({ name: '', role: 'VIEWER' as UserRole })
const generatedKey = ref<string | null>(null)
const loading = ref(false)

const ROLE_OPTIONS = [
  { value: 'VIEWER', label: '조회자' },
  { value: 'EDITOR', label: '작성자' },
  { value: 'REVIEWER', label: '검토자' },
  { value: 'APPROVER', label: '승인자' },
  { value: 'ADMIN', label: '관리자' },
]

async function loadUsers() {
  usersLoading.value = true
  try {
    const { data } = await client.get<UserItem[]>('/auth/users')
    users.value = data
  } catch {
    users.value = []
  } finally {
    usersLoading.value = false
  }
}

async function createUser() {
  if (!newUser.value.email || !newUser.value.password || !newUser.value.name) {
    ElMessage.warning('모든 필드를 입력하세요')
    return
  }
  loading.value = true
  try {
    await client.post('/auth/users', newUser.value)
    ElMessage.success('사용자가 생성되었습니다')
    newUser.value = { email: '', password: '', name: '', role: 'EDITOR' }
    await loadUsers()
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '생성에 실패했습니다'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

async function handleRoleChange(user: UserItem, newRole: string) {
  try {
    await client.patch(`/auth/users/${user.id}/role`, { role: newRole })
    user.role = newRole
    ElMessage.success(`${user.name}의 역할이 변경되었습니다`)
  } catch {
    ElMessage.error('역할 변경에 실패했습니다')
    await loadUsers()
  }
}

async function toggleActive(user: UserItem) {
  try {
    const { data } = await client.patch<UserItem>(`/auth/users/${user.id}/toggle-active`)
    user.isActive = data.isActive
    ElMessage.success(`${user.name} 계정이 ${data.isActive ? '활성화' : '비활성화'}되었습니다`)
  } catch {
    ElMessage.error('상태 변경에 실패했습니다')
    await loadUsers()
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

onMounted(loadUsers)
</script>

<template>
  <div style="height: 100%; overflow-y: auto">
    <h2 style="margin: 0 0 12px; font-size: 20px">사용자 관리</h2>

    <!-- 사용자 목록 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">사용자 목록</span>
      </template>
      <el-table
        v-loading="usersLoading"
        :data="users"
        size="small"
        :header-cell-style="{ background: '#fafafa' }"
      >
        <el-table-column prop="name" label="이름" width="120" />
        <el-table-column prop="email" label="이메일" min-width="200" />
        <el-table-column label="역할" width="140">
          <template #default="{ row }">
            <el-select
              :model-value="row.role"
              size="small"
              style="width: 110px"
              @change="(val: string) => handleRoleChange(row, val)"
            >
              <el-option v-for="r in ROLE_OPTIONS" :key="r.value" :label="r.label" :value="r.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="상태" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.isActive"
              size="small"
              active-text="활성"
              inactive-text="비활성"
              @change="() => toggleActive(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="가입일" width="110" align="center">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleDateString('ko-KR') }}
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!usersLoading && users.length === 0" description="등록된 사용자가 없습니다" />
    </el-card>

    <div style="display: flex; gap: 16px">
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
