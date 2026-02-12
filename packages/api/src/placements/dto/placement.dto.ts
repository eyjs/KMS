import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator'

export class CreatePlacementDto {
  @IsNotEmpty()
  @IsUUID()
  documentId!: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  domainCode!: string

  @IsOptional()
  @IsInt()
  categoryId?: number

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alias?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}

export class UpdatePlacementDto {
  @IsOptional()
  @IsInt()
  categoryId?: number | null

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alias?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}

export class BulkPlacementDto {
  @IsArray()
  @ArrayMinSize(1, { message: '최소 1개 이상의 문서를 선택해야 합니다' })
  @ArrayMaxSize(5000, { message: '한 번에 최대 5,000개까지 배치할 수 있습니다' })
  @IsUUID('4', { each: true })
  documentIds!: string[]

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  domainCode!: string

  @IsOptional()
  @IsInt()
  categoryId?: number
}
