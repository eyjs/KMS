import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * 공통 API 응답 구조 (Swagger 문서화용)
 */

// ============================================================
// 페이지네이션 메타
// ============================================================

export class PaginationMeta {
  @ApiProperty({ example: 100, description: '전체 항목 수' })
  total!: number

  @ApiProperty({ example: 1, description: '현재 페이지' })
  page!: number

  @ApiProperty({ example: 20, description: '페이지당 항목 수' })
  size!: number

  @ApiProperty({ example: 5, description: '전체 페이지 수' })
  totalPages!: number
}

// ============================================================
// 에러 응답
// ============================================================

export class ErrorResponse {
  @ApiProperty({ example: 400, description: 'HTTP 상태 코드' })
  statusCode!: number

  @ApiProperty({ example: '잘못된 요청입니다', description: '에러 메시지' })
  message!: string | string[]

  @ApiProperty({ example: '2026-02-14T10:30:00.000Z', description: '발생 시각' })
  timestamp!: string

  @ApiProperty({ example: '/api/documents', description: '요청 경로' })
  path!: string

  @ApiPropertyOptional({ example: 'abc-123', description: '요청 추적 ID' })
  requestId?: string
}

// ============================================================
// 문서 응답
// ============================================================

export class DocumentResponse {
  @ApiProperty({ example: 'uuid-1234-5678', description: '문서 ID' })
  id!: string

  @ApiProperty({ example: 'DOC-2602-001', description: '문서 코드', nullable: true })
  docCode!: string | null

  @ApiProperty({ example: 'ACTIVE', enum: ['DRAFT', 'ACTIVE', 'DEPRECATED'], description: '라이프사이클 상태' })
  lifecycle!: string

  @ApiProperty({ example: 'INTERNAL', enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'], description: '보안 등급' })
  securityLevel!: string

  @ApiProperty({ example: '보험약관.pdf', description: '파일명', nullable: true })
  fileName!: string | null

  @ApiProperty({ example: 'pdf', enum: ['pdf', 'md', 'csv'], description: '파일 유형', nullable: true })
  fileType!: string | null

  @ApiProperty({ example: 1048576, description: '파일 크기 (bytes)' })
  fileSize!: number

  @ApiProperty({ example: '/api/documents/uuid-1234/file', description: '다운로드 URL', nullable: true })
  downloadUrl!: string | null

  @ApiProperty({ example: 1, description: '메이저 버전' })
  versionMajor!: number

  @ApiProperty({ example: 0, description: '마이너 버전' })
  versionMinor!: number

  @ApiProperty({ example: 'FRESH', enum: ['FRESH', 'WARNING', 'EXPIRED'], description: '신선도', nullable: true })
  freshness!: string | null

  @ApiProperty({ example: 2, description: '배치된 도메인 수' })
  placementCount!: number

  @ApiProperty({ example: '2026-02-14T10:30:00.000Z', description: '생성 시각' })
  createdAt!: string

  @ApiProperty({ example: '2026-02-14T10:30:00.000Z', description: '수정 시각' })
  updatedAt!: string
}

export class DocumentListResponse {
  @ApiProperty({ type: [DocumentResponse], description: '문서 목록' })
  data!: DocumentResponse[]

  @ApiProperty({ type: PaginationMeta, description: '페이지네이션 정보' })
  meta!: PaginationMeta
}

// ============================================================
// 통계 응답
// ============================================================

export class DomainStats {
  @ApiProperty({ example: 'SALES', description: '도메인 코드' })
  domain!: string

  @ApiProperty({ example: '영업', description: '도메인 표시명' })
  displayName!: string

  @ApiProperty({ example: 50, description: '문서 수' })
  total!: number
}

export class StatsResponse {
  @ApiProperty({ example: 100, description: '전체 문서 수' })
  total!: number

  @ApiProperty({ example: 80, description: '활성 문서 수' })
  active!: number

  @ApiProperty({ example: 15, description: '임시저장 문서 수' })
  draft!: number

  @ApiProperty({ example: 5, description: '만료 문서 수' })
  deprecated!: number

  @ApiProperty({ example: 10, description: '미배치 문서 수' })
  orphan!: number

  @ApiProperty({ type: [DomainStats], description: '도메인별 통계' })
  byDomain!: DomainStats[]
}

// ============================================================
// 증분 동기화 응답
// ============================================================

export class ChangedDocument {
  @ApiProperty({ example: 'uuid-1234', description: '문서 ID' })
  id!: string

  @ApiProperty({ example: 'DOC-2602-001', description: '문서 코드', nullable: true })
  docCode!: string | null

  @ApiProperty({ example: '보험약관.pdf', description: '파일명', nullable: true })
  fileName!: string | null
}

export class ChangesResponse {
  @ApiProperty({ type: [ChangedDocument], description: '신규 생성된 문서' })
  created!: ChangedDocument[]

  @ApiProperty({ type: [ChangedDocument], description: '수정된 문서' })
  updated!: ChangedDocument[]

  @ApiProperty({ type: [ChangedDocument], description: '삭제된 문서' })
  deleted!: ChangedDocument[]

  @ApiProperty({ example: '2026-02-14T10:30:00.000Z', description: '동기화 시점' })
  syncedAt!: string
}

// ============================================================
// 헬스체크 응답
// ============================================================

export class HealthCheckDetail {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'], description: '상태' })
  status!: string

  @ApiPropertyOptional({ example: 5, description: '응답 시간 (ms)' })
  latencyMs?: number
}

export class HealthResponse {
  @ApiProperty({ example: 'healthy', enum: ['healthy', 'unhealthy'], description: '전체 상태' })
  status!: string

  @ApiProperty({ example: '2026-02-14T10:30:00.000Z', description: '체크 시각' })
  timestamp!: string

  @ApiPropertyOptional({ example: 12345.67, description: '서버 업타임 (초)' })
  uptime?: number

  @ApiProperty({ description: '개별 체크 결과' })
  checks!: {
    database: HealthCheckDetail
  }

  @ApiPropertyOptional({ example: 10, description: '총 응답 시간 (ms)' })
  responseTimeMs?: number
}

// ============================================================
// 연관 문서 응답 (ADR-016)
// ============================================================

export class RelatedDocumentSummaryDto {
  @ApiProperty({ example: 'uuid-5678', description: '문서 ID' })
  id!: string

  @ApiProperty({ example: 'DOC-2602-002', description: '문서 코드', nullable: true })
  docCode!: string | null

  @ApiProperty({ example: '요약서.pdf', description: '파일명', nullable: true })
  fileName!: string | null

  @ApiProperty({ example: 'ACTIVE', enum: ['DRAFT', 'ACTIVE', 'DEPRECATED'], description: '상태' })
  lifecycle!: string

  @ApiProperty({ example: 'PUBLIC', enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'], description: '보안 등급' })
  securityLevel!: string

  @ApiProperty({ example: '/api/documents/uuid-5678/file', description: '다운로드 URL', nullable: true })
  downloadUrl!: string | null
}

export class RelationGroupDto {
  @ApiProperty({ example: 'PARENT_OF', enum: ['PARENT_OF', 'CHILD_OF', 'SIBLING', 'REFERENCE', 'SUPERSEDES'], description: '관계 유형' })
  relationType!: string

  @ApiProperty({ example: '상위 문서', description: '한국어 라벨' })
  label!: string

  @ApiProperty({ example: 'outgoing', enum: ['outgoing', 'incoming'], description: '관계 방향' })
  direction!: string

  @ApiProperty({ type: [RelatedDocumentSummaryDto], description: '연관 문서 목록' })
  documents!: RelatedDocumentSummaryDto[]
}

export class RelationsResponseDto {
  @ApiProperty({ example: 10, description: '전체 연관 문서 수' })
  totalCount!: number

  @ApiProperty({ example: 5, description: '반환된 문서 수 (권한 필터 후)' })
  returnedCount!: number

  @ApiProperty({ example: false, description: 'limit 초과 여부' })
  hasMore!: boolean

  @ApiProperty({ type: [RelationGroupDto], description: '관계 유형별 그룹' })
  byType!: RelationGroupDto[]
}

// ============================================================
// 접근 가능 문서 응답
// ============================================================

export class AccessibleIdsResponse {
  @ApiProperty({ type: [String], example: ['uuid-1', 'uuid-2'], description: '접근 가능 문서 ID 목록' })
  documentIds!: string[]
}

export class CanAccessResponse {
  @ApiProperty({ example: true, description: '접근 가능 여부' })
  canAccess!: boolean

  @ApiPropertyOptional({ example: '폴더 접근 권한이 없습니다', description: '접근 불가 사유' })
  reason?: string
}
