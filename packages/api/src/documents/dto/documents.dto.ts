import { IsString, IsOptional, IsEnum, IsInt, IsISO8601, Min, Max, IsArray, ArrayMinSize, ArrayMaxSize, IsUUID } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

const VALID_RELATION_TYPES = ['PARENT_OF', 'CHILD_OF', 'SIBLING', 'REFERENCE', 'SUPERSEDES'] as const

const VALID_LIFECYCLES = ['DRAFT', 'ACTIVE', 'DEPRECATED'] as const
const VALID_SECURITY_LEVELS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] as const
const VALID_SORT_FIELDS = ['createdAt', 'updatedAt', 'fileName', 'fileSize', 'lifecycle'] as const
const VALID_FILE_TYPES = ['pdf', 'md', 'csv'] as const

export class DocumentListQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  domain?: string

  @ApiProperty({ required: false, enum: VALID_LIFECYCLES })
  @IsOptional()
  @IsEnum(VALID_LIFECYCLES)
  lifecycle?: (typeof VALID_LIFECYCLES)[number]

  @ApiProperty({ required: false, enum: VALID_SECURITY_LEVELS })
  @IsOptional()
  @IsEnum(VALID_SECURITY_LEVELS)
  securityLevel?: (typeof VALID_SECURITY_LEVELS)[number]

  @ApiProperty({ required: false, enum: VALID_FILE_TYPES, description: '파일 유형 필터' })
  @IsOptional()
  @IsEnum(VALID_FILE_TYPES, { message: '허용되지 않는 파일 유형입니다 (pdf, md, csv)' })
  fileType?: (typeof VALID_FILE_TYPES)[number]

  @ApiProperty({ required: false, description: '미배치 문서만 조회' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  orphan?: boolean

  @ApiProperty({ required: false, description: '생성일 시작 (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: '올바른 날짜 형식이어야 합니다' })
  createdFrom?: string

  @ApiProperty({ required: false, description: '생성일 종료 (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: '올바른 날짜 형식이어야 합니다' })
  createdTo?: string

  @ApiProperty({ required: false, description: '수정일 시작 (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: '올바른 날짜 형식이어야 합니다' })
  updatedFrom?: string

  @ApiProperty({ required: false, description: '수정일 종료 (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: '올바른 날짜 형식이어야 합니다' })
  updatedTo?: string

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number

  @ApiProperty({ required: false, default: 'createdAt', enum: VALID_SORT_FIELDS })
  @IsOptional()
  @IsEnum(VALID_SORT_FIELDS, { message: '허용되지 않는 정렬 필드입니다' })
  sort?: string

  @ApiProperty({ required: false, default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc'
}

export class UploadDocumentBodyDto {
  @ApiProperty({ required: false, enum: VALID_SECURITY_LEVELS })
  @IsOptional()
  @IsEnum(VALID_SECURITY_LEVELS)
  securityLevel?: (typeof VALID_SECURITY_LEVELS)[number]

  @ApiProperty({ required: false, description: '유효기간 (ISO 8601)' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: '올바른 날짜 형식이어야 합니다 (예: 2026-12-31)' })
  validUntil?: string
}

export class UpdateDocumentDto {
  @ApiProperty({ required: false, enum: VALID_SECURITY_LEVELS })
  @IsOptional()
  @IsEnum(VALID_SECURITY_LEVELS)
  securityLevel?: (typeof VALID_SECURITY_LEVELS)[number]

  @ApiProperty({ required: false, description: '유효기간 (ISO 8601, null로 제거)' })
  @IsOptional()
  validUntil?: string | null

  @ApiProperty({ required: false, description: '파일명 변경 (업로더 또는 ADMIN만 가능)' })
  @IsOptional()
  @IsString()
  fileName?: string

  @ApiProperty()
  @IsInt()
  rowVersion!: number
}

const VALID_ISSUE_TYPES = ['warning', 'expired', 'no_file', 'stale_draft', 'long_orphan', 'duplicate_name'] as const

export class IssueQueryDto {
  @ApiProperty({ enum: VALID_ISSUE_TYPES })
  @IsEnum(VALID_ISSUE_TYPES, { message: '유효한 이슈 유형이 아닙니다 (warning, expired, no_file, stale_draft)' })
  type!: (typeof VALID_ISSUE_TYPES)[number]

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number
}

export class TransitionLifecycleDto {
  @ApiProperty({ enum: VALID_LIFECYCLES })
  @IsEnum(VALID_LIFECYCLES, { message: '유효한 라이프사이클 상태가 아닙니다' })
  lifecycle!: (typeof VALID_LIFECYCLES)[number]
}

export class BulkTransitionDto {
  @ApiProperty({ description: '문서 ID 배열 (최대 100건)' })
  @IsArray()
  @ArrayMinSize(1, { message: '최소 1건 이상 선택해야 합니다' })
  @ArrayMaxSize(100, { message: '최대 100건까지 일괄 처리 가능합니다' })
  @IsUUID('4', { each: true, message: '유효한 문서 ID가 아닙니다' })
  ids!: string[]

  @ApiProperty({ enum: VALID_LIFECYCLES })
  @IsEnum(VALID_LIFECYCLES, { message: '유효한 라이프사이클 상태가 아닙니다' })
  lifecycle!: (typeof VALID_LIFECYCLES)[number]
}

/** 증분 동기화 쿼리 (외부 RAG 연동용) */
export class ChangesQueryDto {
  @ApiProperty({ description: '마지막 동기화 시점 (ISO 8601)', example: '2026-02-13T00:00:00Z' })
  @IsISO8601({ strict: false }, { message: 'ISO 8601 형식이어야 합니다' })
  since!: string

  @ApiProperty({ required: false, description: '삭제된 문서 포함 여부', default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean
}

/** 벌크 메타데이터 요청 */
export class BulkMetadataDto {
  @ApiProperty({ description: '문서 ID 배열 (최대 100건)' })
  @IsArray()
  @ArrayMinSize(1, { message: '최소 1건 이상 필요합니다' })
  @ArrayMaxSize(100, { message: '최대 100건까지 조회 가능합니다' })
  @IsUUID('4', { each: true, message: '유효한 문서 ID가 아닙니다' })
  ids!: string[]

  @ApiProperty({ required: false, description: '연관 문서 포함 여부', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeRelations?: boolean
}

/** 문서 상세 조회 쿼리 (ADR-016 지식그래프) */
export class DocumentDetailQueryDto {
  @ApiProperty({ required: false, description: '연관 문서 포함 여부', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeRelations?: boolean

  @ApiProperty({ required: false, description: '관계 탐색 깊이 (1-3)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  relationDepth?: number

  @ApiProperty({ required: false, description: '포함할 관계 유형', enum: VALID_RELATION_TYPES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(VALID_RELATION_TYPES, { each: true, message: '유효한 관계 유형이 아닙니다' })
  @Transform(({ value }) => {
    // 쿼리 파라미터가 단일 값이면 배열로 변환
    if (typeof value === 'string') return [value]
    return value
  })
  relationTypes?: (typeof VALID_RELATION_TYPES)[number][]

  @ApiProperty({ required: false, description: '관계 유형당 최대 문서 수', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  relationLimit?: number
}
