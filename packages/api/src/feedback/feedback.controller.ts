import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { FeedbackService } from './feedback.service'
import { CreateFeedbackDto, UpdateFeedbackDto } from './dto/feedback.dto'

@ApiTags('feedback')
@ApiBearerAuth()
@Controller('feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: '피드백 생성' })
  async create(@Request() req: { user: { id: string } }, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(req.user.id, dto)
  }

  @Get()
  @ApiOperation({ summary: '피드백 목록 (ADMIN=전체, 일반=내것)' })
  async findAll(
    @Request() req: { user: { id: string; role: string } },
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    if (req.user.role === 'ADMIN') {
      return this.feedbackService.findAll({ status, category })
    }
    return this.feedbackService.findByUser(req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: '피드백 상세' })
  async findOne(@Request() req: { user: { id: string; role: string } }, @Param('id') id: string) {
    const feedback = await this.feedbackService.findOne(id)
    if (req.user.role !== 'ADMIN' && feedback.userId !== req.user.id) {
      throw new ForbiddenException('이 피드백에 접근할 권한이 없습니다')
    }
    return feedback
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '피드백 상태/메모 수정 (ADMIN)' })
  async update(@Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    return this.feedbackService.update(id, dto)
  }
}
