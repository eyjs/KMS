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

export const FileType = {
  PDF: 'pdf',
  MD: 'md',
  CSV: 'csv',
} as const
export type FileType = (typeof FileType)[keyof typeof FileType]

// ============================================================
// 권한 체계 (문서 등급 + 사용자 역할 + 폴더 권한)
// ============================================================

/** 폴더 권한 수준 */
export const FolderPermission = {
  NONE: 'NONE',
  READ: 'READ',
  WRITE: 'WRITE',
} as const
export type FolderPermission = (typeof FolderPermission)[keyof typeof FolderPermission]

/** 문서 보안 등급 (숫자가 높을수록 높은 등급) */
export const SecurityLevel = {
  PUBLIC: 'PUBLIC',           // 공개 — 외부업체 포함 누구나
  INTERNAL: 'INTERNAL',      // 사내용 — 직원 이상
  CONFIDENTIAL: 'CONFIDENTIAL', // 대외비(2급) — 검토자 이상
  SECRET: 'SECRET',          // 기밀(1급) — 승인자 이상
} as const
export type SecurityLevel = (typeof SecurityLevel)[keyof typeof SecurityLevel]

/**
 * 사용자 역할 — 업무 역할 기반 (조직 직급 아님!)
 * 조직이 바뀌어도 역할은 업무에 따라 부여
 */
export const UserRole = {
  VIEWER: 'VIEWER',         // 조회자 — 공개 문서만 (외부업체, RAG 등)
  EDITOR: 'EDITOR',         // 작성자 — 사내용까지 (문서 작성/수정)
  REVIEWER: 'REVIEWER',     // 검토자 — 대외비까지 (문서 검토/승인)
  APPROVER: 'APPROVER',     // 승인자 — 기밀까지 (최종 승인 권한)
  ADMIN: 'ADMIN',           // 관리자 — 전체 (시스템 설정)
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
  docCode: string | null
  lifecycle: Lifecycle
  securityLevel: SecurityLevel
  fileName: string | null
  fileType: FileType | null
  fileSize: number
  fileHash: string | null
  downloadUrl: string | null
  versionMajor: number
  versionMinor: number
  reviewedAt: string | null
  validUntil: string | null
  rowVersion: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  freshness: Freshness | null
  placementCount: number
  placements?: DocumentPlacementEntity[]
  relationCount?: number
}

/** 폴더 접근 권한 수준 */
export type FolderAccessLevel = 'INHERIT' | 'RESTRICTED' | 'PUBLIC'

export interface DomainCategoryEntity {
  id: number
  code: string                              // 불변 코드 (자동 채번, 예: GA-F01)
  domainCode: string
  parentId: number | null
  name: string                              // 표시명 (변경 가능)
  sortOrder: number
  accessLevel: FolderAccessLevel            // 접근 권한 수준
  allowedRoles: string[] | null             // RESTRICTED 시 허용 역할
  allowedUserIds: string[] | null           // RESTRICTED 시 허용 사용자 ID
  children?: DomainCategoryEntity[]
  createdAt: string
}

export interface DocumentPlacementEntity {
  id: string
  documentId: string
  domainCode: string
  domainName?: string
  categoryId: number | null
  categoryName: string | null
  categoryCode: string | null               // 폴더 코드 (불변)
  placementCode: string | null              // 경로 기반 배치 코드 (예: GA-F01/DOC-001)
  placedBy: string | null
  placedByName: string | null
  placedAt: string
  alias: string | null
  note: string | null
}

export interface DocumentVersionEntity {
  id: string
  documentId: string
  versionMajor: number
  versionMinor: number
  fileName: string
  fileType: string
  fileSize: number
  fileHash: string
  uploadedByName: string | null
  createdAt: string
}

export interface RelationEntity {
  id: string
  sourceId: string
  targetId: string
  relationType: RelationType
  domainCode: string | null
  createdAt: string
}

export interface DomainMasterEntity {
  code: string
  displayName: string
  parentCode: string | null
  description: string | null
  isActive: boolean
  sortOrder: number
  children?: DomainMasterEntity[]
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

export interface UploadDocumentDto {
  securityLevel?: SecurityLevel
  validUntil?: string
}

export interface UpdateDocumentDto {
  securityLevel?: SecurityLevel
  validUntil?: string | null
  fileName?: string
  rowVersion: number
}

export interface TransitionLifecycleDto {
  lifecycle: Lifecycle
}

export interface CreateRelationDto {
  sourceId: string
  targetId: string
  relationType: RelationType
  domainCode?: string
}

export interface DocumentListQuery {
  domain?: string
  lifecycle?: Lifecycle
  securityLevel?: SecurityLevel
  orphan?: boolean
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

export interface CreateDomainDto {
  code?: string
  displayName: string
  parentCode?: string
  description?: string
  sortOrder?: number
}

export interface UpdateDomainDto {
  displayName?: string
  description?: string
  sortOrder?: number
}

export interface CreateCategoryDto {
  domainCode: string
  parentId?: number
  name: string
  sortOrder?: number
}

export interface UpdateCategoryDto {
  name?: string
  parentId?: number | null
  sortOrder?: number
}

export interface UpdateCategoryPermissionsDto {
  accessLevel: FolderAccessLevel
  allowedRoles?: string[] | null
  allowedUserIds?: string[] | null
}

export interface CreatePlacementDto {
  documentId: string
  domainCode: string
  categoryId?: number
  alias?: string
  note?: string
}

export interface UpdatePlacementDto {
  categoryId?: number | null
  alias?: string | null
  note?: string
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

// ============================================================
// 피드백
// ============================================================

export const FeedbackCategory = {
  BUG: 'BUG',
  IMPROVEMENT: 'IMPROVEMENT',
  QUESTION: 'QUESTION',
} as const
export type FeedbackCategory = (typeof FeedbackCategory)[keyof typeof FeedbackCategory]

export const FeedbackStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const
export type FeedbackStatus = (typeof FeedbackStatus)[keyof typeof FeedbackStatus]

export interface FeedbackEntity {
  id: string
  userId: string
  category: FeedbackCategory
  title: string
  content: string
  status: FeedbackStatus
  adminNote: string | null
  pageUrl: string | null
  createdAt: string
  updatedAt: string
  user?: Pick<UserEntity, 'id' | 'name' | 'email'>
}

export interface CreateFeedbackDto {
  category: FeedbackCategory
  title: string
  content: string
  pageUrl?: string
}

export interface UpdateFeedbackDto {
  status?: FeedbackStatus
  adminNote?: string
}

// ============================================================
// 관계 그래프 (vis-network용)
// ============================================================

export interface GraphNode {
  id: string
  docCode: string | null
  fileName: string | null
  lifecycle: Lifecycle
  securityLevel: SecurityLevel
  depth: number
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  relationType: RelationType
  domainCode: string | null
}

export interface RelationGraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  centerId: string
}

// ============================================================
// 일괄 배치 (Bulk Placement)
// ============================================================

export interface BulkPlacementDto {
  documentIds: string[]
  domainCode: string
  categoryId?: number
}

export interface BulkPlacementResult {
  success: number
  failed: number
  errors: Array<{ documentId: string; reason: string }>
}

// ============================================================
// 전역 관계 그래프
// ============================================================

export interface GlobalGraphQuery {
  domain?: string
  maxNodes?: number
}

export interface GlobalGraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  hasMore: boolean
}

// ============================================================
// 권한 그룹
// ============================================================

export interface PermissionGroupEntity {
  id: string
  name: string
  description: string | null
  isActive: boolean
  memberCount?: number
  folderCount?: number
  createdAt: string
  updatedAt: string
}

export interface UserGroupMembershipEntity {
  id: string
  userId: string
  groupId: string
  joinedAt: string
  user?: Pick<UserEntity, 'id' | 'name' | 'email'>
  group?: Pick<PermissionGroupEntity, 'id' | 'name'>
}

export interface GroupFolderAccessEntity {
  id: string
  groupId: string
  categoryId: number
  accessType: 'READ' | 'WRITE'
  includeChildren: boolean
  grantedAt: string
  groupName?: string
  folderName?: string
  folderCode?: string
  folderPath?: string
  domainCode?: string
}

// ============================================================
// 권한 그룹 DTO
// ============================================================

export interface CreateGroupDto {
  name: string
  description?: string
}

export interface UpdateGroupDto {
  name?: string
  description?: string
  isActive?: boolean
}

export interface SetFolderAccessDto {
  categoryId: number
  accessType: 'READ' | 'WRITE'
  includeChildren?: boolean
}

export interface AddGroupMemberDto {
  userId: string
}

export interface UpdateUserGroupsDto {
  groupIds: string[]
}
