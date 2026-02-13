import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { PlacementsService } from './placements.service'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreatePlacementDto, UpdatePlacementDto, BulkPlacementDto } from './dto/placement.dto'
import type { UserRole } from '@kms/shared'

interface AuthRequest {
  user: { sub: string; email: string; role: UserRole }
}

@ApiTags('placements')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PlacementsController {
  constructor(
    private readonly placementsService: PlacementsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('documents/:id/placements')
  @ApiOperation({ summary: '문서의 배치 목록' })
  async findByDocument(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    return this.placementsService.findByDocument(id, req.user.role)
  }

  @Get('domains/:code/documents')
  @ApiOperation({ summary: '도메인에 배치된 문서 목록' })
  async findByDomain(
    @Param('code') code: string,
    @Query('categoryId') categoryId?: string,
    @Query('lifecycle') lifecycle?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('includeSubdomains') includeSubdomains?: string,
    @Request() req?: AuthRequest,
  ) {
    let domainCodes: string | string[] = code
    if (includeSubdomains === 'true') {
      domainCodes = await this.getDescendantDomainCodes(code)
    }
    return this.placementsService.findByDomain(
      domainCodes,
      {
        categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
        lifecycle: lifecycle || undefined,
        sort: sort || undefined,
        order: (order === 'asc' || order === 'desc') ? order : undefined,
        page: parseInt(page ?? '1', 10),
        size: parseInt(size ?? '20', 10),
      },
      req!.user.role,
    )
  }

  /** 해당 도메인 + 모든 하위 도메인 코드를 BFS로 수집 */
  private async getDescendantDomainCodes(code: string): Promise<string[]> {
    const domains = await this.prisma.domainMaster.findMany({
      where: { isActive: true },
      select: { code: true, parentCode: true },
    })
    const childrenMap = new Map<string, string[]>()
    for (const d of domains) {
      if (d.parentCode) {
        const siblings = childrenMap.get(d.parentCode) ?? []
        siblings.push(d.code)
        childrenMap.set(d.parentCode, siblings)
      }
    }
    const result: string[] = [code]
    const queue = [code]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const child of childrenMap.get(current) ?? []) {
        result.push(child)
        queue.push(child)
      }
    }
    return result
  }

  @Post('placements')
  @Roles('EDITOR')
  @ApiOperation({ summary: '문서를 도메인에 배치' })
  async create(
    @Body() dto: CreatePlacementDto,
    @Request() req: AuthRequest,
  ) {
    return this.placementsService.create(dto, req.user.sub, req.user.role)
  }

  @Post('placements/bulk')
  @Roles('EDITOR')
  @ApiOperation({ summary: '문서 일괄 배치' })
  async bulkCreate(
    @Body() dto: BulkPlacementDto,
    @Request() req: AuthRequest,
  ) {
    return this.placementsService.bulkCreate(dto, req.user.sub, req.user.role)
  }

  @Patch('placements/:id')
  @Roles('EDITOR')
  @ApiOperation({ summary: '배치 수정 (카테고리/별칭/메모)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlacementDto,
  ) {
    return this.placementsService.update(id, dto)
  }

  @Delete('placements/:id')
  @Roles('EDITOR')
  @ApiOperation({ summary: '배치 제거 (원본은 유지)' })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ) {
    return this.placementsService.remove(id, req.user.sub)
  }
}
