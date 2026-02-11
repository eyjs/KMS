import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator'
import { FeedbackCategory, FeedbackStatus } from '@kms/shared'

export class CreateFeedbackDto {
  @IsEnum(FeedbackCategory)
  category!: string

  @IsString()
  @MaxLength(200)
  title!: string

  @IsString()
  content!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageUrl?: string
}

export class UpdateFeedbackDto {
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: string

  @IsOptional()
  @IsString()
  adminNote?: string
}
