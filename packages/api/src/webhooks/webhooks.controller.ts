import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger'
import { WebhooksService } from './webhooks.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhooks.dto'
import { ErrorResponse } from '../common/dto/api-response.dto'

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'Webhook 목록 조회 (ADMIN)', description: '등록된 모든 Webhook을 조회합니다.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async findAll(
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.webhooksService.findAll(
      parseInt(page ?? '1', 10),
      parseInt(size ?? '20', 10),
    )
  }

  @Get(':id')
  @ApiOperation({ summary: 'Webhook 상세 조회 (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({ status: 404, description: 'Webhook 없음', type: ErrorResponse })
  async findOne(@Param('id') id: string) {
    return this.webhooksService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Webhook 생성 (ADMIN)', description: '새 Webhook을 등록합니다.' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 400, description: '유효성 검증 실패', type: ErrorResponse })
  async create(@Body() body: CreateWebhookDto) {
    return this.webhooksService.create(body)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Webhook 수정 (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({ status: 404, description: 'Webhook 없음', type: ErrorResponse })
  async update(@Param('id') id: string, @Body() body: UpdateWebhookDto) {
    return this.webhooksService.update(id, body)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Webhook 삭제 (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({ status: 404, description: 'Webhook 없음', type: ErrorResponse })
  async remove(@Param('id') id: string) {
    await this.webhooksService.remove(id)
    return { message: '삭제되었습니다' }
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Webhook 테스트 전송 (ADMIN)', description: '테스트 페이로드를 전송합니다.' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({ status: 404, description: 'Webhook 없음', type: ErrorResponse })
  async test(@Param('id') id: string) {
    return this.webhooksService.testWebhook(id)
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Webhook 전송 이력 조회 (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 404, description: 'Webhook 없음', type: ErrorResponse })
  async getDeliveries(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.webhooksService.getDeliveries(
      id,
      parseInt(page ?? '1', 10),
      parseInt(size ?? '20', 10),
    )
  }
}
