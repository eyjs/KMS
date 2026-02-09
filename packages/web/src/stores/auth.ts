import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { client } from '@/api/client'
import { ROLE_ORDER, SECURITY_LEVEL_ORDER, ROLE_ACCESS_LEVELS } from '@kms/shared'
import type { UserRole, SecurityLevel, TokenResponse } from '@kms/shared'
import { router } from '@/router'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const user = ref<{ id: string; email: string; name: string; role: UserRole } | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value)

  const userRoleLevel = computed(() =>
    user.value ? ROLE_ORDER[user.value.role] ?? 0 : 0,
  )

  function init() {
    const stored = localStorage.getItem('kms_auth')
    if (stored) {
      try {
        const data = JSON.parse(stored) as TokenResponse
        if (data.accessToken && data.refreshToken && data.user) {
          accessToken.value = data.accessToken
          refreshToken.value = data.refreshToken
          user.value = data.user as { id: string; email: string; name: string; role: UserRole }
        }
      } catch {
        localStorage.removeItem('kms_auth')
      }
    }
  }

  async function login(email: string, password: string) {
    const { data } = await client.post<TokenResponse>('/auth/login', { email, password })
    setTokens(data)
  }

  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false
    try {
      const { data } = await client.post<TokenResponse>('/auth/refresh', {
        refreshToken: refreshToken.value,
      })
      setTokens(data)
      return true
    } catch {
      return false
    }
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem('kms_auth')
    router.push('/login')
  }

  function canAccessSecurityLevel(level: SecurityLevel): boolean {
    if (!user.value) return false
    const allowed = ROLE_ACCESS_LEVELS[user.value.role]
    return allowed?.includes(level) ?? false
  }

  function canAccessDocument(securityLevel: SecurityLevel): boolean {
    return canAccessSecurityLevel(securityLevel)
  }

  /** 역할이 최소 요구 역할 이상인지 확인 */
  function hasMinRole(minRole: UserRole): boolean {
    return userRoleLevel.value >= (ROLE_ORDER[minRole] ?? 999)
  }

  function setTokens(data: TokenResponse) {
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    user.value = data.user as { id: string; email: string; name: string; role: UserRole }
    localStorage.setItem('kms_auth', JSON.stringify(data))
  }

  return {
    accessToken,
    refreshToken,
    user,
    isAuthenticated,
    userRoleLevel,
    init,
    login,
    refresh,
    logout,
    canAccessSecurityLevel,
    canAccessDocument,
    hasMinRole,
  }
})
