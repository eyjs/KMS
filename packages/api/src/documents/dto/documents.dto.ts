import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsNotEmpty } from 'class-validator'
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  carrier?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  product?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  docType?: string

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
}

export class UpdateDocumentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  classifications?: Record<string, string>

  @ApiProperty({ required: false, enum: VALID_SECURITY_LEVELS })
  @IsOptional()
  @IsEnum(VALID_SECURITY_LEVELS)
  securityLevel?: (typeof VALID_SECURITY_LEVELS)[number]

  @ApiProperty()
  @IsInt()
  rowVersion!: number
}

export class TransitionLifecycleDto {
  @ApiProperty({ enum: VALID_LIFECYCLES })
  @IsEnum(VALID_LIFECYCLES, { message: '유효한 라이프사이클 상태가 아닙니다' })
  lifecycle!: (typeof VALID_LIFECYCLES)[number]
}
