import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
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
