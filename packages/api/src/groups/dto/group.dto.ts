import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsOptional, IsBoolean, IsUUID, IsInt, IsIn } from 'class-validator'

export class CreateGroupDto {
  @ApiProperty({ description: '그룹 이름' })
  @IsString()
  name!: string

  @ApiPropertyOptional({ description: '그룹 설명' })
  @IsOptional()
  @IsString()
  description?: string
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ description: '그룹 이름' })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ description: '그룹 설명' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class AddGroupMemberDto {
  @ApiProperty({ description: '사용자 ID' })
  @IsUUID()
  userId!: string
}

export class SetFolderAccessDto {
  @ApiProperty({ description: '폴더(카테고리) ID' })
  @IsInt()
  categoryId!: number

  @ApiProperty({ description: '권한 유형', enum: ['READ', 'WRITE'] })
  @IsIn(['READ', 'WRITE'])
  accessType!: 'READ' | 'WRITE'

  @ApiPropertyOptional({ description: '하위 폴더 포함 여부', default: true })
  @IsOptional()
  @IsBoolean()
  includeChildren?: boolean
}

export class UpdateUserGroupsDto {
  @ApiProperty({ description: '그룹 ID 목록', type: [String] })
  @IsUUID('4', { each: true })
  groupIds!: string[]
}
