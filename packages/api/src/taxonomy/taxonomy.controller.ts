import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TaxonomyService } from './taxonomy.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('taxonomy')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('domains')
  @ApiOperation({ summary: '도메인 목록 조회' })
  async getDomains() {
    return this.taxonomyService.getDomains()
  }

  @Get('domains/:code')
  @ApiOperation({ summary: '도메인 상세 조회' })
  async getDomain(@Param('code') code: string) {
    return this.taxonomyService.getDomain(code)
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
