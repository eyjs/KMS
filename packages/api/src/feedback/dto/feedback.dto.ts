import { IsString, IsIn, IsOptional, MaxLength } from 'class-validator'
import { FeedbackCategory, FeedbackStatus } from '@kms/shared'

export class CreateFeedbackDto {
  @IsIn(Object.values(FeedbackCategory))
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
  @IsIn(Object.values(FeedbackStatus))
  status?: string

  @IsOptional()
  @IsString()
  adminNote?: string
}
