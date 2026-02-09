import { IsNotEmpty, IsString, IsEnum, IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

const VALID_RELATION_TYPES = ['PARENT_OF', 'CHILD_OF', 'SIBLING', 'REFERENCE', 'SUPERSEDES'] as const

export class CreateRelationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  sourceId!: string

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  targetId!: string

  @ApiProperty({ enum: VALID_RELATION_TYPES })
  @IsEnum(VALID_RELATION_TYPES, { message: '유효한 관계 유형이 아닙니다' })
  relationType!: (typeof VALID_RELATION_TYPES)[number]
}
