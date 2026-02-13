/**
 * 포맷팅 유틸리티
 */

/**
 * ISO 날짜 문자열을 한국어 날짜 형식으로 변환합니다.
 * @param dateStr - ISO 날짜 문자열 (예: '2024-01-15T10:30:00Z')
 * @returns 한국어 날짜 형식 (예: '2024. 1. 15.')
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

/**
 * ISO 날짜 문자열을 한국어 날짜+시간 형식으로 변환합니다.
 * @param dateStr - ISO 날짜 문자열
 * @returns 한국어 날짜+시간 형식 (예: '2024. 1. 15. 오후 2:30:00')
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR')
}

/**
 * ISO 날짜 문자열을 짧은 한국어 날짜+시간 형식으로 변환합니다.
 * @param dateStr - ISO 날짜 문자열
 * @returns 짧은 날짜+시간 형식 (예: '2024.01.15 14:30')
 */
export function formatDateTimeShort(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 숫자를 한국어 천 단위 구분자로 포맷팅합니다.
 * @param num - 숫자
 * @returns 포맷팅된 문자열 (예: '1,234,567')
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR')
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환합니다.
 * @param bytes - 바이트 단위 크기
 * @returns 포맷팅된 문자열 (예: '1.5 MB')
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
