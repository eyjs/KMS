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
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TaxonomyService } from './taxonomy.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateDomainDto, UpdateDomainDto } from './dto/taxonomy.dto'

@ApiTags('taxonomy')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('domains')
  @ApiOperation({ summary: '도메인 목록 조회 (트리 구조)' })
  async getDomains() {
    return this.taxonomyService.getDomains()
  }

  @Get('domains/flat')
  @ApiOperation({ summary: '도메인 목록 조회 (flat)' })
  async getDomainsFlat() {
    return this.taxonomyService.getDomainsFlat()
  }

  @Get('domains/:code')
  @ApiOperation({ summary: '도메인 상세 조회' })
  async getDomain(@Param('code') code: string) {
    return this.taxonomyService.getDomain(code)
  }

  @Post('domains')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '도메인 생성 (ADMIN)' })
  async createDomain(@Body() dto: CreateDomainDto) {
    return this.taxonomyService.createDomain(dto)
  }

  @Put('domains/:code')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '도메인 수정 (ADMIN)' })
  async updateDomain(
    @Param('code') code: string,
    @Body() dto: UpdateDomainDto,
  ) {
    return this.taxonomyService.updateDomain(code, dto)
  }

  @Delete('domains/:code')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '도메인 삭제 (ADMIN, soft delete)' })
  async deleteDomain(@Param('code') code: string) {
    await this.taxonomyService.deleteDomain(code)
  }

  @Get('taxonomy/:facetType')
  @ApiOperation({ summary: '분류 마스터 조회 (facetType별)' })
  async getFacets(
    @Param('facetType') facetType: string,
    @Query('domain') domain?: string,
  ) {
    return this.taxonomyService.getFacets(facetType, domain)
  }
}
