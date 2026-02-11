import type { Lifecycle, RelationType, SecurityLevel, UserRole } from './types'

// ============================================================
// 라이프사이클 전환 규칙
// ============================================================

export const LIFECYCLE_TRANSITIONS: Record<Lifecycle, Lifecycle[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['DRAFT', 'DEPRECATED'],
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

/** 역할별 접근 가능한 최대 보안 등급 — 업무 역할 기반 (직급 무관) */
export const ROLE_ACCESS_LEVELS: Record<UserRole, SecurityLevel[]> = {
  VIEWER: ['PUBLIC'],
  EDITOR: ['PUBLIC', 'INTERNAL'],
  REVIEWER: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
  APPROVER: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'],
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
  VIEWER: 0,
  EDITOR: 1,
  REVIEWER: 2,
  APPROVER: 3,
  ADMIN: 4,
}

/** 역할 한국어 라벨 */
export const ROLE_LABELS: Record<string, string> = {
  VIEWER: '조회자',
  EDITOR: '작성자',
  REVIEWER: '검토자',
  APPROVER: '승인자',
  ADMIN: '관리자',
}

// ============================================================
// 라이프사이클 한국어 라벨
// ============================================================

export const LIFECYCLE_LABELS: Record<string, string> = {
  DRAFT: '임시저장',
  ACTIVE: '사용중',
  DEPRECATED: '만료',
}

export const SECURITY_LEVEL_LABELS: Record<string, string> = {
  PUBLIC: '공개',
  INTERNAL: '사내용',
  CONFIDENTIAL: '대외비(2급)',
  SECRET: '기밀(1급)',
}

export const RELATION_TYPE_LABELS: Record<string, string> = {
  PARENT_OF: '상위',
  CHILD_OF: '하위',
  SIBLING: '형제',
  REFERENCE: '참조',
  SUPERSEDES: '대체',
}

export const FRESHNESS_LABELS: Record<string, string> = {
  FRESH: '정상',
  WARNING: '갱신필요',
  EXPIRED: '만료됨',
}

// ============================================================
// Facet 타입 한국어 라벨
// ============================================================

export const FACET_TYPE_LABELS: Record<string, string> = {
  carrier: '보험사',
  product: '상품',
  docType: '문서유형',
}

// ============================================================
// 허용 파일 형식
// ============================================================

export const ALLOWED_FILE_TYPES = ['pdf', 'md', 'csv'] as const

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// ============================================================
// 코드 자동 생성
// ============================================================

/** Facet 타입별 코드 접두어 */
export const FACET_TYPE_CODE_PREFIX: Record<string, string> = {
  carrier: 'C',
  product: 'P',
  docType: 'T',
}

/** 기본 Facet 접두어 (매핑에 없는 타입용) */
export const FACET_DEFAULT_PREFIX = 'F'

/** 도메인 최대 깊이 — 루트(0) + 3단계 업무 세분화 */
export const DOMAIN_MAX_DEPTH = 4

/**
 * 깊이별 업무 레벨 라벨
 * 도메인 = 불변하는 업무 단위 (조직이 아님!)
 * 조직(본부/부서/팀)은 바뀌지만 업무(영업/수수료/보상)는 불변
 */
export const DOMAIN_LEVEL_LABELS: Record<number, string> = {
  0: '사업영역',
  1: '업무영역',
  2: '세부업무',
  3: '업무프로세스',
}

// ============================================================
// 문서 이력 액션 라벨 + 태그 타입
// ============================================================

export const ACTION_LABELS: Record<string, string> = {
  CREATE: '업로드',
  UPDATE: '수정',
  LIFECYCLE_CHANGE: '상태 변경',
  DELETE: '삭제',
  FILE_ATTACH: '파일 첨부',
  RELATION_ADD: '관계 추가',
  RELATION_REMOVE: '관계 삭제',
  SECURITY_CHANGE: '보안등급 변경',
  CLASSIFICATION_CHANGE: '분류 변경',
}

export const ACTION_TAG_TYPES: Record<string, string> = {
  CREATE: 'success',
  UPDATE: 'primary',
  LIFECYCLE_CHANGE: 'warning',
  DELETE: 'danger',
  FILE_ATTACH: 'primary',
  RELATION_ADD: 'success',
  RELATION_REMOVE: 'danger',
  SECURITY_CHANGE: 'warning',
  CLASSIFICATION_CHANGE: 'primary',
}

/** 도메인 생성 안내 — 조직이 아닌 업무 기준임을 강제 */
export const DOMAIN_GUIDANCE = {
  principle: '도메인은 불변하는 업무 단위입니다. 조직(본부/부서/팀)이 아닌 업무를 기준으로 설정하세요.',
  examples: {
    correct: ['영업', '수수료', '계약관리', '보상', '신계약', '정산'],
    wrong: ['영업본부', '법인영업부', '대기업팀', '삼성생명', '종신보험'],
  },
  facetGuide: '보험사·상품·문서유형은 분류(Facet)에서 관리합니다.',
}

