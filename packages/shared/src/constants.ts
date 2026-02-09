import type { DomainDefinition, Lifecycle, RelationType, SecurityLevel, UserRole } from './types'

// ============================================================
// 도메인 정의
// ============================================================

export const DOMAINS: Record<string, DomainDefinition> = {
  'GA-SALES': {
    code: 'GA-SALES',
    name: 'GA 영업지원',
    facets: ['carrier', 'product', 'docType'],
    ssotKey: ['carrier', 'product', 'docType'],
  },
  'GA-COMM': {
    code: 'GA-COMM',
    name: 'GA 수수료',
    facets: ['carrier', 'product', 'docType'],
    ssotKey: ['carrier', 'product', 'docType'],
  },
  'GA-CONTRACT': {
    code: 'GA-CONTRACT',
    name: 'GA 계약관리',
    facets: ['carrier', 'product', 'docType'],
    ssotKey: ['carrier', 'product', 'docType'],
  },
  'GA-COMP': {
    code: 'GA-COMP',
    name: 'GA 보상',
    facets: ['carrier', 'product', 'docType'],
    ssotKey: ['carrier', 'product', 'docType'],
  },
  'GA-EDU': {
    code: 'GA-EDU',
    name: 'GA 교육',
    facets: ['carrier', 'product', 'docType'],
    ssotKey: ['carrier', 'product', 'docType'],
  },
  'COMMON-COMP': {
    code: 'COMMON-COMP',
    name: '공통 규정',
    facets: ['docType'],
    ssotKey: ['docType'],
  },
}

// ============================================================
// 라이프사이클 전환 규칙
// ============================================================

export const LIFECYCLE_TRANSITIONS: Record<Lifecycle, Lifecycle[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['DEPRECATED'],
  DEPRECATED: [],
}

// ============================================================
// 신선도 기준 (일 단위)
// ============================================================

export const FRESHNESS_THRESHOLDS = {
  HOT: 30,
  WARM: 90,
  COLD: 365,
} as const

// ============================================================
// 관계 메타데이터
// ============================================================

export const RELATION_META: Record<RelationType, {
  inverse: RelationType | null
  bidirectional: boolean
  scope: 'same_domain' | 'cross_domain' | 'any'
}> = {
  PARENT_OF: { inverse: 'CHILD_OF', bidirectional: true, scope: 'same_domain' },
  CHILD_OF: { inverse: 'PARENT_OF', bidirectional: true, scope: 'same_domain' },
  SIBLING: { inverse: 'SIBLING', bidirectional: true, scope: 'same_domain' },
  REFERENCE: { inverse: null, bidirectional: false, scope: 'any' },
  SUPERSEDES: { inverse: null, bidirectional: false, scope: 'same_domain' },
}

// ============================================================
// 권한 체계: 역할별 접근 가능 문서 등급
// ============================================================

/** 역할별 접근 가능한 최대 보안 등급 */
export const ROLE_ACCESS_LEVELS: Record<UserRole, SecurityLevel[]> = {
  EXTERNAL: ['PUBLIC'],
  EMPLOYEE: ['PUBLIC', 'INTERNAL'],
  TEAM_LEAD: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
  EXECUTIVE: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'],
  ADMIN: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'],
}

/** 보안 등급 수준 (비교용) */
export const SECURITY_LEVEL_ORDER: Record<SecurityLevel, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  SECRET: 3,
}

/** 역할 수준 (비교용) */
export const ROLE_ORDER: Record<UserRole, number> = {
  EXTERNAL: 0,
  EMPLOYEE: 1,
  TEAM_LEAD: 2,
  EXECUTIVE: 3,
  ADMIN: 4,
}

// ============================================================
// 허용 파일 형식
// ============================================================

export const ALLOWED_FILE_TYPES = ['pdf', 'md', 'csv'] as const

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// ============================================================
// 문서유형 → 도메인 매핑
// ============================================================

export const DOC_TYPE_DOMAIN_MAP: Record<string, string> = {
  '상품요약서': 'GA-SALES',
  '판매가이드': 'GA-SALES',
  '상품비교표': 'GA-SALES',
  '보장분석표': 'GA-SALES',
  '언더라이팅가이드': 'GA-SALES',
  '청약서양식': 'GA-SALES',
  '영업매뉴얼': 'GA-SALES',
  '수수료표': 'GA-COMM',
  '수수료기준': 'GA-COMM',
  '성과급기준': 'GA-COMM',
  '정산가이드': 'GA-COMM',
  '인센티브기준': 'GA-COMM',
  '계약관리매뉴얼': 'GA-CONTRACT',
  '계약변경가이드': 'GA-CONTRACT',
  '해지환급금표': 'GA-CONTRACT',
  '보전가이드': 'GA-CONTRACT',
  '보상매뉴얼': 'GA-COMP',
  '보험금청구가이드': 'GA-COMP',
  '손해사정가이드': 'GA-COMP',
  '교육자료': 'GA-EDU',
  '시험대비자료': 'GA-EDU',
  '자격증가이드': 'GA-EDU',
  '연수교재': 'GA-EDU',
  '사내규정': 'COMMON-COMP',
  '컴플라이언스가이드': 'COMMON-COMP',
  '개인정보처리방침': 'COMMON-COMP',
  '윤리강령': 'COMMON-COMP',
}
