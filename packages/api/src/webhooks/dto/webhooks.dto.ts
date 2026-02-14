import { IsString, IsOptional, IsArray, IsBoolean, IsUrl, ArrayMinSize, IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

const VALID_EVENTS = [
  'document.created',
  'document.updated',
  'document.deleted',
  'document.lifecycle_changed',
  'document.file_uploaded',
  'relation.added',
  'relation.removed',
] as const

export class CreateWebhookDto {
  @ApiProperty({ example: 'RAG 동기화', description: 'Webhook 이름' })
  @IsString()
  name!: string

  @ApiProperty({ example: 'https://example.com/webhook', description: 'Webhook URL' })
  @IsUrl({}, { message: '올바른 URL 형식이어야 합니다' })
  url!: string

  @ApiProperty({ required: false, description: 'HMAC 서명용 시크릿' })
  @IsOptional()
  @IsString()
  secret?: string

  @ApiProperty({
    type: [String],
    enum: VALID_EVENTS,
    description: '구독할 이벤트 목록',
    example: ['document.created', 'document.updated'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: '최소 1개 이상의 이벤트를 선택해야 합니다' })
  @IsEnum(VALID_EVENTS, { each: true, message: '유효한 이벤트가 아닙니다' })
  events!: (typeof VALID_EVENTS)[number][]
}

export class UpdateWebhookDto {
  @ApiProperty({ required: false, example: 'RAG 동기화 v2', description: 'Webhook 이름' })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ required: false, example: 'https://example.com/webhook/v2', description: 'Webhook URL' })
  @IsOptional()
  @IsUrl({}, { message: '올바른 URL 형식이어야 합니다' })
  url?: string

  @ApiProperty({ required: false, description: 'HMAC 서명용 시크릿 (null로 제거)' })
  @IsOptional()
  @IsString()
  secret?: string

  @ApiProperty({ required: false, type: [String], enum: VALID_EVENTS, description: '구독할 이벤트 목록' })
  @IsOptional()
  @IsArray()
  @IsEnum(VALID_EVENTS, { each: true, message: '유효한 이벤트가 아닙니다' })
  events?: (typeof VALID_EVENTS)[number][]

  @ApiProperty({ required: false, description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
