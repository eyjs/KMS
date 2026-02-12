import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDomainStore } from './domain'
import type { DomainMasterEntity } from '@kms/shared'

const RECENT_DOMAINS_KEY = 'kms:recentDomains'
const MAX_RECENT_DOMAINS = 5

export const useNavigationStore = defineStore('navigation', () => {
  const recentDomainCodes = ref<string[]>([])

  // 초기화: localStorage에서 불러오기
  function init() {
    try {
      const saved = localStorage.getItem(RECENT_DOMAINS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 유효성 검증: 문자열 배열인지 확인
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
          recentDomainCodes.value = parsed
        } else {
          // 잘못된 데이터 형식 - 초기화
          localStorage.removeItem(RECENT_DOMAINS_KEY)
          recentDomainCodes.value = []
        }
      }
    } catch {
      // 파싱 실패 시 손상된 데이터 제거
      localStorage.removeItem(RECENT_DOMAINS_KEY)
      recentDomainCodes.value = []
    }
  }

  // 저장
  function save() {
    localStorage.setItem(RECENT_DOMAINS_KEY, JSON.stringify(recentDomainCodes.value))
  }

  // 도메인 방문 기록
  function visitDomain(code: string) {
    // 이미 있으면 제거 후 맨 앞에 추가
    const filtered = recentDomainCodes.value.filter((c) => c !== code)
    recentDomainCodes.value = [code, ...filtered].slice(0, MAX_RECENT_DOMAINS)
    save()
  }

  // 최근 방문 도메인 (도메인 정보 포함)
  const recentDomains = computed<DomainMasterEntity[]>(() => {
    const domainStore = useDomainStore()
    return recentDomainCodes.value
      .map((code) => domainStore.domainsFlat.find((d) => d.code === code))
      .filter((d): d is DomainMasterEntity => d !== undefined)
  })

  init()

  return {
    recentDomainCodes,
    recentDomains,
    visitDomain,
  }
})
