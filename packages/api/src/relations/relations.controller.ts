import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
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

  @Get('relations/graph/global')
  @ApiOperation({ summary: '전역 관계 그래프 조회' })
  async getGlobalGraph(
    @Query('domain') domain: string | undefined,
    @Query('maxNodes') maxNodes: string | undefined,
    @Request() req: AuthRequest,
  ) {
    const parsed = maxNodes ? parseInt(maxNodes, 10) : NaN
    const max = !isNaN(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200
    return this.relationsService.getGlobalGraph(req.user.role, max, domain)
  }

  @Get('relations/graph/domain/:domainCode')
  @ApiOperation({ summary: '도메인 관계 그래프 조회' })
  async getDomainRelationGraph(
    @Param('domainCode') domainCode: string,
    @Query('maxNodes') maxNodes: string | undefined,
    @Request() req: AuthRequest,
  ) {
    const max = maxNodes ? Math.min(parseInt(maxNodes, 10) || 200, 500) : 200
    return this.relationsService.getRelationGraphByDomain(domainCode, req.user.role, max)
  }

  @Get('documents/:id/relations/graph')
  @ApiOperation({ summary: '관계 그래프 조회 (BFS)' })
  async getRelationGraph(
    @Param('id') id: string,
    @Query('depth') depth: string | undefined,
    @Query('domain') domainCode: string | undefined,
    @Request() req: AuthRequest,
  ) {
    const d = depth ? Math.min(parseInt(depth, 10) || 1, 3) : 1
    return this.relationsService.getRelationGraph(id, req.user.role, d, domainCode)
  }

  @Get('documents/:id/relations')
  @ApiOperation({ summary: '문서 관계 조회 (전 도메인)' })
  async findByDocument(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.relationsService.findByDocument(id, req.user.role)
  }

  @Get('domains/:code/documents/:id/relations')
  @ApiOperation({ summary: '도메인 내 문서 관계 조회' })
  async findByDocumentInDomain(
    @Param('code') code: string,
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    return this.relationsService.findByDocumentInDomain(id, code, req.user.role)
  }

  @Post('relations')
  @Roles('EDITOR')
  @ApiOperation({ summary: '관계 생성 (작성자 이상)' })
  async create(@Body() dto: CreateRelationDto, @Request() req: AuthRequest) {
    return this.relationsService.create(
      dto.sourceId,
      dto.targetId,
      dto.relationType,
      dto.domainCode,
      req.user.sub,
      req.user.role,
    )
  }

  @Delete('relations/:id')
  @Roles('EDITOR')
  @ApiOperation({ summary: '관계 삭제 (작성자 이상)' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.relationsService.remove(id, req.user.sub, req.user.role)
  }
}
