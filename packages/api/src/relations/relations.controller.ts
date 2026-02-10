import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { RelationsService } from './relations.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateRelationDto } from './dto/relations.dto'
import type { UserRole } from '@kms/shared'

interface AuthRequest {
  user: { sub: string; email: string; role: UserRole }
}

@ApiTags('relations')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RelationsController {
  constructor(private readonly relationsService: RelationsService) {}

  @Get('documents/:id/relations')
  @ApiOperation({ summary: '문서 관계 조회' })
  async findByDocument(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.relationsService.findByDocument(id, req.user.role)
  }

  @Post('relations')
  @Roles('EDITOR')
  @ApiOperation({ summary: '관계 생성 (작성자 이상)' })
  async create(@Body() dto: CreateRelationDto, @Request() req: AuthRequest) {
    return this.relationsService.create(
      dto.sourceId,
      dto.targetId,
      dto.relationType,
      req.user.sub,
      req.user.role,
    )
  }

  @Delete('relations/:id')
  @Roles('EDITOR')
  @ApiOperation({ summary: '관계 삭제 (작성자 이상)' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.relationsService.remove(id, req.user.sub)
  }
}
