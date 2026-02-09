<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    ElMessage.warning('아이디와 비밀번호를 입력하세요')
    return
  }

  loading.value = true
  try {
    await auth.login(email.value, password.value)
    // Open redirect 방지: 내부 경로만 허용
    const redirect = (route.query.redirect as string) || '/'
    const safePath = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
    router.push(safePath)
  } catch {
    ElMessage.error('로그인에 실패했습니다')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f2f5">
    <el-card style="width: 400px">
      <template #header>
        <h2 style="text-align: center; margin: 0">KMS 문서관리 시스템</h2>
      </template>
      <el-form @submit.prevent="handleLogin">
        <el-form-item label="아이디">
          <el-input v-model="email" placeholder="admin" />
        </el-form-item>
        <el-form-item label="비밀번호">
          <el-input v-model="password" type="password" placeholder="비밀번호" show-password />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">
          로그인
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>
