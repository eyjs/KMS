import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  MaxLength,
  Matches,
} from 'class-validator'

export class CreateDomainDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z][A-Z0-9_-]*$/, {
    message: '코드는 대문자로 시작하고 대문자/숫자/하이픈/언더스코어만 허용됩니다',
  })
  code!: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  displayName!: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z][A-Z0-9_-]*$/, {
    message: '코드는 대문자로 시작하고 대문자/숫자/하이픈/언더스코어만 허용됩니다',
  })
  parentCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFacets?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ssotKey?: string[]

  @IsOptional()
  @IsInt()
  sortOrder?: number
}

export class UpdateDomainDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFacets?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ssotKey?: string[]

  @IsOptional()
  @IsInt()
  sortOrder?: number
}
