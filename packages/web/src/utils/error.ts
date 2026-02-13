/**
 * API 에러 메시지 추출 유틸리티
 */

interface ApiError {
  response?: {
    data?: {
      message?: string
    }
  }
}

/**
 * Axios 에러에서 API 응답 메시지를 추출합니다.
 * @param err - catch 블록에서 받은 에러 객체
 * @param defaultMessage - API 메시지가 없을 때 표시할 기본 메시지
 * @returns API 응답 메시지 또는 기본 메시지
 */
export function getApiErrorMessage(err: unknown, defaultMessage: string): string {
  return (err as ApiError)?.response?.data?.message ?? defaultMessage
}
