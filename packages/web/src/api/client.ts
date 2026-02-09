import axios from 'axios'
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
    return Promise.reject(error)
  },
)

export { client }
