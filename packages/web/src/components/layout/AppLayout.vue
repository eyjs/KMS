<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const menuItems = [
  { path: '/', label: '대시보드', icon: 'Monitor' },
  { path: '/documents', label: '문서 목록', icon: 'Document' },
  { path: '/upload', label: '업로드', icon: 'Upload' },
  { path: '/graph', label: '관계 그래프', icon: 'Share' },
]

const ROLE_LABELS: Record<string, string> = {
  EXTERNAL: '외부업체',
  EMPLOYEE: '직원',
  TEAM_LEAD: '팀장',
  EXECUTIVE: '임원',
  ADMIN: '관리자',
}

function handleLogout() {
  auth.logout()
}
</script>

<template>
  <el-container style="min-height: 100vh">
    <el-aside width="220px" style="background: #304156">
      <div style="padding: 20px; color: #fff; font-size: 18px; font-weight: bold; text-align: center">
        KMS
      </div>
      <el-menu
        :default-active="$route.path"
        :router="true"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <span>{{ item.label }}</span>
        </el-menu-item>
        <el-menu-item
          v-if="auth.hasMinRole('ADMIN')"
          index="/settings"
        >
          <span>설정</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="display: flex; align-items: center; justify-content: flex-end; gap: 16px; border-bottom: 1px solid #e6e6e6">
        <el-tag size="small" :type="auth.user?.role === 'ADMIN' ? 'danger' : 'info'">
          {{ ROLE_LABELS[auth.user?.role ?? ''] ?? auth.user?.role }}
        </el-tag>
        <span>{{ auth.user?.name }}</span>
        <el-button size="small" @click="handleLogout">로그아웃</el-button>
      </el-header>

      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
