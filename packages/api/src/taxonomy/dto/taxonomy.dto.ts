import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsIn,
  MaxLength,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator'

export class CreateDomainDto {
  @IsOptional()
  @ValidateIf((o) => o.code !== undefined && o.code !== '')
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z][A-Z0-9_-]*$/, {
    message: '코드는 대문자로 시작하고 대문자/숫자/하이픈/언더스코어만 허용됩니다',
  })
  code?: string

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

export class CreateFacetDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  facetType!: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  displayName!: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  domain?: string

  @IsOptional()
  @IsIn(['HOT', 'WARM', 'COLD'])
  tier?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAgeDays?: number

  @IsOptional()
  @IsInt()
  sortOrder?: number
}

export class UpdateFacetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  domain?: string

  @IsOptional()
  @IsIn(['HOT', 'WARM', 'COLD'])
  tier?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAgeDays?: number

  @IsOptional()
  @IsInt()
  sortOrder?: number
}

export class CreateFacetTypeDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z][a-zA-Z0-9]*$/, {
    message: '코드는 영문자로 시작하고 영문자/숫자만 허용됩니다',
  })
  code!: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  displayName!: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(5)
  codePrefix!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  domain?: string

  @IsOptional()
  @IsInt()
  sortOrder?: number
}

export class UpdateFacetTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string

  @IsOptional()
  @IsString()
  @MaxLength(5)
  codePrefix?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

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

