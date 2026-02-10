import axios from 'axios'
import { ElNotification } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
})

// 요청 인터셉터: JWT 토큰 자동 추가
client.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }
  return config
})

// 토큰 갱신 중복 요청 방지
let isRefreshing = false
let pendingRequests: Array<(token: string) => void> = []

function onRefreshed(token: string) {
  pendingRequests.forEach((cb) => cb(token))
  pendingRequests = []
}

// 응답 인터셉터: 401 시 토큰 갱신 시도
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const auth = useAuthStore()

      if (isRefreshing) {
        // 이미 갱신 중이면 대기열에 추가
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(client(original))
          })
        })
      }

      isRefreshing = true
      try {
        const refreshed = await auth.refresh()
        if (refreshed && auth.accessToken) {
          onRefreshed(auth.accessToken)
          original.headers.Authorization = `Bearer ${auth.accessToken}`
          return client(original)
        }
        auth.logout()
      } catch {
        auth.logout()
      } finally {
        isRefreshing = false
      }
    }
    // 401 이외의 에러 전역 알림 (컴포넌트가 개별 처리하지 않는 유형만)
    if (error.response?.status !== 401 && !original?._skipGlobalNotify) {
      const status = error.response?.status
      if (status === 403) {
        ElNotification({ title: '권한 없음', message: '이 작업을 수행할 권한이 없습니다.', type: 'error' })
      } else if (!error.response) {
        ElNotification({ title: '네트워크 오류', message: '서버에 연결할 수 없습니다.', type: 'error' })
      }
    }
    return Promise.reject(error)
  },
)

export { client }
