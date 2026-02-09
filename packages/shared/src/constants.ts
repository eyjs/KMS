import type { Lifecycle, RelationType, SecurityLevel, UserRole } from './types'

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

