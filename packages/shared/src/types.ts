// ============================================================
// 코어 Enum (const object + type 패턴으로 런타임 값 + 타입 모두 제공)
// ============================================================

export const Lifecycle = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
} as const
export type Lifecycle = (typeof Lifecycle)[keyof typeof Lifecycle]

export const RelationType = {
  PARENT_OF: 'PARENT_OF',
  CHILD_OF: 'CHILD_OF',
  SIBLING: 'SIBLING',
  REFERENCE: 'REFERENCE',
  SUPERSEDES: 'SUPERSEDES',
} as const
export type RelationType = (typeof RelationType)[keyof typeof RelationType]

export const Freshness = {
  FRESH: 'FRESH',
  WARNING: 'WARNING',
  EXPIRED: 'EXPIRED',
} as const
export type Freshness = (typeof Freshness)[keyof typeof Freshness]

export const Tier = {
  HOT: 'HOT',
  WARM: 'WARM',
  COLD: 'COLD',
} as const
export type Tier = (typeof Tier)[keyof typeof Tier]

export const FileType = {
  PDF: 'pdf',
  MD: 'md',
  CSV: 'csv',
} as const
export type FileType = (typeof FileType)[keyof typeof FileType]

// ============================================================
// 권한 체계 (문서 등급 + 사용자 역할)
// ============================================================

/** 문서 보안 등급 (숫자가 높을수록 높은 등급) */
export const SecurityLevel = {
  PUBLIC: 'PUBLIC',           // 공개 — 외부업체 포함 누구나
  INTERNAL: 'INTERNAL',      // 사내용 — 직원 이상
  CONFIDENTIAL: 'CONFIDENTIAL', // 대외비(2급) — 팀장 이상
  SECRET: 'SECRET',          // 기밀(1급) — 임원 이상
} as const
export type SecurityLevel = (typeof SecurityLevel)[keyof typeof SecurityLevel]

/** 사용자 역할 (접근 가능 범위 결정) */
export const UserRole = {
  EXTERNAL: 'EXTERNAL',     // 외부업체 (RAG 구축용 등)
  EMPLOYEE: 'EMPLOYEE',     // 일반 직원
  TEAM_LEAD: 'TEAM_LEAD',   // 팀장급
  EXECUTIVE: 'EXECUTIVE',   // 임원급
  ADMIN: 'ADMIN',           // 시스템 관리자 (모든 권한)
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

// ============================================================
// 엔티티 (API 응답)
// ============================================================

export interface UserEntity {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DocumentEntity {
  id: string
  domain: string
  lifecycle: Lifecycle
  securityLevel: SecurityLevel
  fileName: string | null
  fileType: FileType | null
  fileSize: number
  downloadUrl: string | null
  versionMajor: number
  versionMinor: number
  classificationHash: string
  reviewedAt: string | null
  validUntil: string | null
  rowVersion: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  classifications: Record<string, string>
  freshness: Freshness | null
}

export interface RelationEntity {
  id: string
  sourceId: string
  targetId: string
  relationType: RelationType
  createdAt: string
}

export interface DomainMasterEntity {
  code: string
  displayName: string
  parentCode: string | null
  description: string | null
  requiredFacets: string[]
  ssotKey: string[]
  isActive: boolean
  sortOrder: number
  children?: DomainMasterEntity[]
}

export interface FacetMasterEntity {
  id: number
  facetType: string
  code: string
  displayName: string
  parentCode: string | null
  domain: string | null
  tier: Tier | null
  maxAgeDays: number | null
  sortOrder: number
  isActive: boolean
}

export interface ApiKeyEntity {
  id: string
  name: string
  keyPrefix: string
  role: UserRole
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

// ============================================================
// DTO (API 요청)
// ============================================================

export interface LoginDto {
  email: string
  password: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  user: Pick<UserEntity, 'id' | 'email' | 'name' | 'role'>
}

export interface RefreshTokenDto {
  refreshToken: string
}

export interface CreateDocumentDto {
  domain: string
  classifications: Record<string, string>
  securityLevel?: SecurityLevel
  lifecycle?: Lifecycle
  title?: string
  validUntil?: string
}

export interface UpdateDocumentDto {
  classifications?: Record<string, string>
  securityLevel?: SecurityLevel
  validUntil?: string | null
  rowVersion: number
}

export interface TransitionLifecycleDto {
  lifecycle: Lifecycle
}

export interface CreateRelationDto {
  sourceId: string
  targetId: string
  relationType: RelationType
}

export interface DocumentListQuery {
  domain?: string
  lifecycle?: Lifecycle
  securityLevel?: SecurityLevel
  classifications?: string
  page?: number
  size?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateUserDto {
  email: string
  password: string
  name: string
  role: UserRole
}

export interface UpdateUserDto {
  name?: string
  role?: UserRole
  isActive?: boolean
}

export interface CreateApiKeyDto {
  name: string
  role: UserRole
  expiresAt?: string
}

export interface CreateFacetDto {
  facetType: string
  code: string
  displayName: string
  parentCode?: string
  domain?: string
  tier?: Tier
  maxAgeDays?: number
  sortOrder?: number
}

export interface UpdateFacetDto {
  displayName?: string
  parentCode?: string
  domain?: string
  tier?: Tier
  maxAgeDays?: number
  sortOrder?: number
}

export interface CreateDomainDto {
  code: string
  displayName: string
  parentCode?: string
  description?: string
  requiredFacets?: string[]
  ssotKey?: string[]
  sortOrder?: number
}

export interface UpdateDomainDto {
  displayName?: string
  description?: string
  requiredFacets?: string[]
  ssotKey?: string[]
  sortOrder?: number
}

// ============================================================
// 페이지네이션
// ============================================================

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    size: number
    totalPages: number
  }
}

