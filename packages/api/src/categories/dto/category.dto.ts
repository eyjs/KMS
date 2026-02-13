import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
  IsIn,
  IsArray,
  IsUUID,
} from 'class-validator'

export class CreateCategoryDto {
  @IsOptional()
  @IsInt()
  parentId?: number

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsInt()
  parentId?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class MoveCategoryDto {
  @IsOptional()
  @IsInt()
  parentId?: number | null
}

export class UpdateCategoryPermissionsDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['INHERIT', 'RESTRICTED', 'PUBLIC'])
  accessLevel!: 'INHERIT' | 'RESTRICTED' | 'PUBLIC'

  @IsOptional()
  @IsArray()
  @IsIn(['VIEWER', 'EDITOR', 'REVIEWER', 'APPROVER', 'ADMIN'], { each: true })
  allowedRoles?: string[] | null

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allowedUserIds?: string[] | null
}
