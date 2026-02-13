<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDomainStore } from '@/stores/domain'
import { useNavigationStore } from '@/stores/navigation'
import { useRoute, useRouter } from 'vue-router'
import DomainMenuItem from './DomainMenuItem.vue'
import DomainBrowserDialog from './DomainBrowserDialog.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { feedbackApi } from '@/api/feedback'
import { FEEDBACK_CATEGORY_LABELS } from '@kms/shared'
import { ElMessage } from 'element-plus'
import type { FeedbackCategory } from '@kms/shared'

useKeyboardShortcuts()

const auth = useAuthStore()
const domainStore = useDomainStore()
const navigationStore = useNavigationStore()
const route = useRoute()
const router = useRouter()

const collapsed = ref(false)
const domainBrowserVisible = ref(false)

// 도메인 방문 시 최근 기록에 추가
watch(
  () => route.params.domainCode,
  (code) => {
    if (code && typeof code === 'string') {
      navigationStore.visitDomain(code)
    }
  },
  { immediate: true },
)

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

// ── 피드백 ──
const feedbackVisible = ref(false)
const feedbackLoading = ref(false)
const feedbackForm = ref({
  category: 'BUG' as FeedbackCategory,
  title: '',
  content: '',
})

function openFeedback() {
  feedbackForm.value = { category: 'BUG', title: '', content: '' }
  feedbackVisible.value = true
}

async function submitFeedback() {
  if (!feedbackForm.value.title.trim() || !feedbackForm.value.content.trim()) {
    ElMessage.warning('제목과 내용을 입력해 주세요')
    return
  }
  feedbackLoading.value = true
  try {
    await feedbackApi.create({
      category: feedbackForm.value.category,
      title: feedbackForm.value.title,
      content: feedbackForm.value.content,
      pageUrl: route.fullPath,
    })
    ElMessage.success('피드백이 접수되었습니다. 감사합니다!')
    feedbackVisible.value = false
  } catch {
    ElMessage.error('전송에 실패했습니다')
  } finally {
    feedbackLoading.value = false
  }
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

      <!-- 접속정보 -->
      <div style="flex-shrink: 0; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); background: #1d1e2c">
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
        <el-menu-item index="/documents">
          <el-icon><component is="Files" /></el-icon>
          <template #title><span>전체 문서함</span></template>
        </el-menu-item>
        <el-menu-item index="/my-documents">
          <el-icon><component is="Folder" /></el-icon>
          <template #title><span>내 문서함</span></template>
        </el-menu-item>
        <el-menu-item index="/search">
          <el-icon><component is="Search" /></el-icon>
          <template #title>
            <span style="display: flex; align-items: center; width: 100%">
              <span>통합 검색</span>
              <span style="font-size: 10px; color: #6b6e7e; margin-left: auto">Ctrl+K</span>
            </span>
          </template>
        </el-menu-item>
        <el-menu-item index="/graph">
          <el-icon><component is="Share" /></el-icon>
          <template #title><span>관계 그래프</span></template>
        </el-menu-item>

        <!-- DOMAINS -->
        <div v-if="!collapsed" style="padding: 20px 20px 6px; font-size: 11px; color: #6b6e7e; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; justify-content: space-between">
          <span>Domains</span>
          <el-button text size="small" style="color: #6b6e7e; padding: 0; font-size: 10px" @click="domainBrowserVisible = true">
            검색
          </el-button>
        </div>
        <div v-if="collapsed" style="padding: 20px 8px 6px; text-align: center">
          <el-button text size="small" style="color: #6b6e7e; padding: 0" @click="domainBrowserVisible = true">
            <el-icon><component is="More" /></el-icon>
          </el-button>
        </div>

        <!-- 전체 도메인 트리 (루트부터 고정) -->
        <domain-menu-item
          v-for="d in domainStore.domainTree"
          :key="d.code"
          :domain="d"
          :show-children="true"
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
          <el-menu-item index="/admin/permissions">
            <el-icon><component is="Lock" /></el-icon>
            <template #title><span>권한 관리</span></template>
          </el-menu-item>
          <el-menu-item index="/admin/feedback">
            <el-icon><component is="ChatDotRound" /></el-icon>
            <template #title><span>피드백 관리</span></template>
          </el-menu-item>
          <el-menu-item index="/admin/audit">
            <el-icon><component is="Document" /></el-icon>
            <template #title><span>감사 로그</span></template>
          </el-menu-item>
        </template>
      </el-menu>

    </el-aside>

    <el-container>
      <el-main style="padding: 16px; background: #f5f7fa; overflow: hidden; min-height: 0">
        <router-view />
      </el-main>
    </el-container>

    <!-- 피드백 플로팅 버튼 -->
    <el-button
      type="primary"
      circle
      size="large"
      style="position: fixed; bottom: 24px; right: 24px; width: 48px; height: 48px; z-index: 1000; box-shadow: 0 4px 12px rgba(64,158,255,0.4)"
      @click="openFeedback"
    >
      <el-icon :size="22"><component is="ChatDotRound" /></el-icon>
    </el-button>

    <!-- 도메인 브라우저 다이얼로그 -->
    <domain-browser-dialog v-model:visible="domainBrowserVisible" />

    <!-- 피드백 다이얼로그 -->
    <el-dialog v-model="feedbackVisible" title="피드백 보내기" width="480px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="유형">
          <el-radio-group v-model="feedbackForm.category">
            <el-radio-button v-for="(label, key) in FEEDBACK_CATEGORY_LABELS" :key="key" :value="key">
              {{ label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="제목" required>
          <el-input v-model="feedbackForm.title" placeholder="간단히 요약해 주세요" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="내용" required>
          <el-input
            v-model="feedbackForm.content"
            type="textarea"
            :rows="5"
            placeholder="자세히 설명해 주세요. 어떤 페이지에서 어떤 문제가 있었는지 포함하면 도움이 됩니다."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feedbackVisible = false">취소</el-button>
        <el-button type="primary" :loading="feedbackLoading" @click="submitFeedback">전송</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<style scoped>
/* collapse 모드에서 el-menu의 기본 너비 오버라이드 */
:deep(.el-menu--collapse) {
  width: 64px !important;
}
</style>
