import { IsString, IsOptional, IsEnum, IsInt, IsISO8601, Min, Max, IsNotEmpty, ValidateIf, IsArray, ArrayMinSize, ArrayMaxSize, IsUUID } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

const VALID_LIFECYCLES = ['DRAFT', 'ACTIVE', 'DEPRECATED'] as const
const VALID_SECURITY_LEVELS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] as const
const VALID_SORT_FIELDS = ['createdAt', 'updatedAt', 'fileName', 'fileSize', 'lifecycle'] as const

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

  @ApiProperty({ required: false, description: 'JSON string of facet filters, e.g. {"facetType":"facetValue"}' })
  @IsOptional()
  @IsString()
  classifications?: string

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

export class CreateDocumentBodyDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  domain!: string

  @ApiProperty({ description: 'JSON string of classifications' })
  @IsNotEmpty()
  @IsString()
  classifications!: string

  @ApiProperty({ required: false, enum: VALID_SECURITY_LEVELS })
  @IsOptional()
  @IsEnum(VALID_SECURITY_LEVELS)
  securityLevel?: (typeof VALID_SECURITY_LEVELS)[number]

  @ApiProperty({ required: false, description: '문서 제목 (파일 없이 생성 시 사용)' })
  @IsOptional()
  @IsString()
  title?: string

  @ApiProperty({ required: false, description: '유효기간 (ISO 8601)' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: '올바른 날짜 형식이어야 합니다 (예: 2026-12-31)' })
  validUntil?: string
}

export class UpdateDocumentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  classifications?: Record<string, string>

  @ApiProperty({ required: false, enum: VALID_SECURITY_LEVELS })
  @IsOptional()
  @IsEnum(VALID_SECURITY_LEVELS)
  securityLevel?: (typeof VALID_SECURITY_LEVELS)[number]

  @ApiProperty({ required: false, description: '유효기간 (ISO 8601, null로 제거)' })
  @IsOptional()
  @ValidateIf((o) => o.validUntil !== null)
  @IsISO8601({ strict: false }, { message: '올바른 날짜 형식이어야 합니다 (예: 2026-12-31)' })
  validUntil?: string | null

  @ApiProperty()
  @IsInt()
  rowVersion!: number
}

const VALID_ISSUE_TYPES = ['warning', 'expired', 'no_file', 'stale_draft'] as const

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
