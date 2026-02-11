import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  MaxLength,
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
