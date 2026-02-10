<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDomainStore } from '@/stores/domain'
import { useRoute, useRouter } from 'vue-router'
import DomainMenuItem from './DomainMenuItem.vue'

const auth = useAuthStore()
const domainStore = useDomainStore()
const route = useRoute()
const router = useRouter()

const collapsed = ref(false)

const ROLE_LABELS: Record<string, string> = {
  VIEWER: '조회자',
  EDITOR: '작성자',
  REVIEWER: '검토자',
  APPROVER: '승인자',
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

const sidebarWidth = computed(() => collapsed.value ? '64px' : '220px')

onMounted(() => {
  domainStore.loadDomains()
})

function handleLogout() {
  auth.logout()
}
</script>

<template>
  <el-container style="height: 100vh; overflow: hidden">
    <el-aside :width="sidebarWidth" :style="{ background: '#1d1e2c', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s' }">
      <!-- 로고 + 접기 버튼 -->
      <div style="padding: 14px 12px; color: #fff; font-size: 18px; font-weight: bold; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 8px">
        <span v-if="!collapsed">KMS</span>
        <span v-else style="font-size: 14px">K</span>
        <el-button
          text
          size="small"
          style="color: #6b6e7e; padding: 2px; margin-left: auto"
          @click="collapsed = !collapsed"
        >
          {{ collapsed ? '»' : '«' }}
        </el-button>
      </div>

      <el-menu
        :default-active="activeMenu"
        :router="true"
        :collapse="collapsed"
        background-color="#1d1e2c"
        text-color="#a3a6b4"
        active-text-color="#409eff"
        style="border-right: none; flex: 1; overflow-y: auto"
      >
        <!-- SYSTEM -->
        <div v-if="!collapsed" style="padding: 16px 20px 6px; font-size: 11px; color: #6b6e7e; text-transform: uppercase; letter-spacing: 1px">
          System
        </div>
        <el-menu-item index="/">
          <el-icon><component is="Monitor" /></el-icon>
          <template #title><span>대시보드</span></template>
        </el-menu-item>
        <el-menu-item index="/search">
          <el-icon><component is="Search" /></el-icon>
          <template #title><span>통합 검색</span></template>
        </el-menu-item>

        <!-- DOMAINS -->
        <div v-if="!collapsed" style="padding: 20px 20px 6px; font-size: 11px; color: #6b6e7e; text-transform: uppercase; letter-spacing: 1px">
          Domains
        </div>
        <domain-menu-item
          v-for="d in domainStore.domainTree"
          :key="d.code"
          :domain="d"
        />

        <!-- ADMIN -->
        <template v-if="auth.hasMinRole('ADMIN')">
          <div v-if="!collapsed" style="padding: 20px 20px 6px; font-size: 11px; color: #6b6e7e; text-transform: uppercase; letter-spacing: 1px">
            Admin
          </div>
          <el-menu-item index="/admin/domains">
            <el-icon><component is="Setting" /></el-icon>
            <template #title><span>도메인 관리</span></template>
          </el-menu-item>
          <el-menu-item index="/admin/users">
            <el-icon><component is="User" /></el-icon>
            <template #title><span>사용자 관리</span></template>
          </el-menu-item>
        </template>
      </el-menu>

      <!-- 하단 사용자 정보 -->
      <div style="flex-shrink: 0; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); background: #1d1e2c">
        <div v-if="!collapsed" style="display: flex; align-items: center; justify-content: space-between">
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
        <div v-else style="text-align: center">
          <el-avatar :size="28" style="background: #409eff">
            {{ auth.user?.name?.charAt(0) ?? '' }}
          </el-avatar>
        </div>
      </div>
    </el-aside>

    <el-container>
      <el-main style="padding: 16px; background: #f5f7fa; overflow: hidden; min-height: 0">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
/* collapse 모드에서 el-menu의 기본 너비 오버라이드 */
:deep(.el-menu--collapse) {
  width: 64px !important;
}
</style>
