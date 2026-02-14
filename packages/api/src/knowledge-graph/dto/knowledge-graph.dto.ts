import { IsString, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { RelationType } from '@kms/shared'

export class ExploreGraphQueryDto {
  @ApiProperty({ description: '시작 문서 ID' })
  @IsString()
  startId!: string

  @ApiPropertyOptional({ description: '탐색 깊이 (1-3)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  depth?: number = 1

  @ApiPropertyOptional({ description: '포함할 관계 유형', type: [String] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  relationTypes?: RelationType[]

  @ApiPropertyOptional({ description: '최대 노드 수', default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxNodes?: number = 100
}

/** 관계 속성 설정 DTO */
export class SetRelationPropertyDto {
  @ApiProperty({
    description: '속성 키 (strength, reason, validUntil, confidence, createdByType)',
    example: 'reason',
  })
  @IsString()
  key!: string

  @ApiProperty({
    description: '속성 값',
    example: '이 문서는 상위 정책 문서의 세부 구현 가이드입니다.',
  })
  @IsString()
  value!: string
}
