<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDomainStore } from '@/stores/domain'
import { useRoute, useRouter } from 'vue-router'
import DomainMenuItem from './DomainMenuItem.vue'

const auth = useAuthStore()
const domainStore = useDomainStore()
const route = useRoute()
const router = useRouter()

const ROLE_LABELS: Record<string, string> = {
  EXTERNAL: '외부업체',
  EMPLOYEE: '직원',
  TEAM_LEAD: '팀장',
  EXECUTIVE: '임원',
  ADMIN: '관리자',
}

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/d/')) {
    const domainCode = route.params.domainCode as string
    return `/d/${domainCode}`
  }
  if (path.startsWith('/admin/')) return path
  return path
})

onMounted(() => {
  domainStore.loadDomains()
})

function handleLogout() {
  auth.logout()
}
</script>

<template>
  <el-container style="min-height: 100vh">
    <el-aside width="220px" style="background: #1d1e2c; display: flex; flex-direction: column; overflow: hidden">
      <div style="padding: 20px 16px; color: #fff; font-size: 18px; font-weight: bold; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0">
        KMS
      </div>

      <el-menu
        :default-active="activeMenu"
        :router="true"
        background-color="#1d1e2c"
        text-color="#a3a6b4"
        active-text-color="#409eff"
        style="border-right: none; flex: 1; overflow-y: auto"
      >
        <!-- SYSTEM -->
        <div style="padding: 16px 20px 6px; font-size: 11px; color: #6b6e7e; text-transform: uppercase; letter-spacing: 1px">
          System
        </div>
        <el-menu-item index="/">
          <el-icon><component is="Monitor" /></el-icon>
          <span>대시보드</span>
        </el-menu-item>
        <el-menu-item index="/search">
          <el-icon><component is="Search" /></el-icon>
          <span>통합 검색</span>
        </el-menu-item>

        <!-- DOMAINS -->
        <div style="padding: 20px 20px 6px; font-size: 11px; color: #6b6e7e; text-transform: uppercase; letter-spacing: 1px">
          Domains
        </div>
        <domain-menu-item
          v-for="d in domainStore.domainTree"
          :key="d.code"
          :domain="d"
        />

        <!-- ADMIN -->
        <template v-if="auth.hasMinRole('ADMIN')">
          <div style="padding: 20px 20px 6px; font-size: 11px; color: #6b6e7e; text-transform: uppercase; letter-spacing: 1px">
            Admin
          </div>
          <el-menu-item index="/admin/domains">
            <el-icon><component is="Setting" /></el-icon>
            <span>도메인 관리</span>
          </el-menu-item>
          <el-menu-item index="/admin/users">
            <el-icon><component is="User" /></el-icon>
            <span>사용자 관리</span>
          </el-menu-item>
        </template>
      </el-menu>

      <!-- 하단 사용자 정보 -->
      <div style="flex-shrink: 0; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); background: #1d1e2c">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0">
            <el-avatar :size="28" style="background: #409eff; flex-shrink: 0">
              {{ auth.user?.name?.charAt(0) ?? '' }}
            </el-avatar>
            <div style="min-width: 0">
              <div style="color: #e0e0e0; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                {{ auth.user?.name }}
              </div>
              <div style="color: #6b6e7e; font-size: 11px">
                {{ ROLE_LABELS[auth.user?.role ?? ''] ?? auth.user?.role }}
              </div>
            </div>
          </div>
          <el-button text size="small" style="color: #6b6e7e" @click="handleLogout">
            로그아웃
          </el-button>
        </div>
      </div>
    </el-aside>

    <el-container>
      <el-main style="padding: 20px; background: #f5f7fa">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
