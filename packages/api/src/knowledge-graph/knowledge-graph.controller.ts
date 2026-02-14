import { Controller, Get, Post, Delete, Query, Param, Body, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger'
import { KnowledgeGraphService } from './knowledge-graph.service'
import { ExploreGraphQueryDto, SetRelationPropertyDto } from './dto/knowledge-graph.dto'
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard'
import type {
  UserRole,
  RelationType,
  KnowledgeGraphResponse,
  OntologyGraphResponse,
  RelationTypeEntity,
  RelationPropertyEntity,
} from '@kms/shared'

interface AuthRequest {
  user: {
    sub: string
    role: UserRole
    isApiKey?: boolean
    groupIds?: string[]
  }
}

@ApiTags('knowledge-graph')
@ApiBearerAuth()
@ApiSecurity('api-key')
@UseGuards(JwtOrApiKeyGuard)
@Controller('knowledge-graph')
export class KnowledgeGraphController {
  constructor(private readonly knowledgeGraphService: KnowledgeGraphService) {}

  @Get('explore')
  @ApiOperation({
    summary: '지식그래프 탐색',
    description: '시작 문서에서 연결된 문서들을 BFS로 탐색하여 노드/엣지 그래프를 반환합니다. RAG 시스템 컨텍스트 구성에 활용됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '그래프 탐색 결과',
    schema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              docCode: { type: 'string', nullable: true },
              fileName: { type: 'string', nullable: true },
              fileType: { type: 'string', nullable: true },
              lifecycle: { type: 'string' },
              securityLevel: { type: 'string' },
              depth: { type: 'number' },
              accessible: { type: 'boolean' },
            },
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              sourceId: { type: 'string' },
              targetId: { type: 'string' },
              relationType: { type: 'string' },
              domainCode: { type: 'string', nullable: true },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            startId: { type: 'string' },
            maxDepth: { type: 'number' },
            totalNodes: { type: 'number' },
            accessibleNodes: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: '시작 문서를 찾을 수 없음' })
  async explore(
    @Query() query: ExploreGraphQueryDto,
    @Request() req: AuthRequest,
  ): Promise<KnowledgeGraphResponse> {
    return this.knowledgeGraphService.explore(query.startId, req.user.role, req.user, {
      depth: query.depth,
      relationTypes: query.relationTypes as RelationType[],
      maxNodes: query.maxNodes,
    })
  }

  @Get('path')
  @ApiOperation({
    summary: '두 문서 간 최단 경로 탐색',
    description: '두 문서 사이의 최단 관계 경로를 찾습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '경로 탐색 결과',
    schema: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        path: { type: 'array', items: { type: 'string' } },
        relations: { type: 'array' },
      },
    },
  })
  async findPath(
    @Query('fromId') fromId: string,
    @Query('toId') toId: string,
    @Request() req: AuthRequest,
  ) {
    const result = await this.knowledgeGraphService.findPath(fromId, toId, req.user.role)
    return {
      found: result !== null,
      path: result?.path ?? [],
      relations: result?.relations ?? [],
    }
  }

  // ============================================================
  // 온톨로지 API (ADR-016 Phase 3)
  // ============================================================

  @Get('explore-ontology')
  @ApiOperation({
    summary: '온톨로지 지식그래프 탐색',
    description: '관계 유형 메타데이터와 속성을 포함한 지식그래프를 반환합니다. 관계의 의미(semantics)를 포함합니다.',
  })
  @ApiResponse({ status: 200, description: '온톨로지 그래프 탐색 결과' })
  @ApiResponse({ status: 404, description: '시작 문서를 찾을 수 없음' })
  async exploreOntology(
    @Query() query: ExploreGraphQueryDto,
    @Request() req: AuthRequest,
  ): Promise<OntologyGraphResponse> {
    return this.knowledgeGraphService.exploreWithOntology(query.startId, req.user.role, req.user, {
      depth: query.depth,
      relationTypes: query.relationTypes as RelationType[],
      maxNodes: query.maxNodes,
    })
  }

  @Get('relation-types')
  @ApiOperation({
    summary: '관계 유형 목록',
    description: '시스템에 정의된 모든 관계 유형과 메타데이터를 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '관계 유형 목록' })
  async getRelationTypes(): Promise<RelationTypeEntity[]> {
    return this.knowledgeGraphService.getRelationTypes()
  }

  @Get('relations/:id/properties')
  @ApiOperation({
    summary: '관계 속성 조회',
    description: '특정 관계에 설정된 속성(의미 부여)들을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '관계 속성 목록' })
  async getRelationProperties(
    @Param('id') id: string,
  ): Promise<RelationPropertyEntity[]> {
    return this.knowledgeGraphService.getRelationProperties(id)
  }

  @Post('relations/:id/properties')
  @ApiOperation({
    summary: '관계 속성 설정',
    description: '관계에 속성(의미)을 부여합니다. 기존 키가 있으면 업데이트합니다.',
  })
  @ApiResponse({ status: 201, description: '속성 설정 완료' })
  @ApiResponse({ status: 404, description: '관계를 찾을 수 없음' })
  async setRelationProperty(
    @Param('id') id: string,
    @Body() dto: SetRelationPropertyDto,
  ): Promise<RelationPropertyEntity> {
    return this.knowledgeGraphService.setRelationProperty(id, dto.key, dto.value)
  }

  @Delete('relations/:id/properties/:key')
  @ApiOperation({
    summary: '관계 속성 삭제',
    description: '관계에서 특정 속성을 삭제합니다.',
  })
  @ApiResponse({ status: 200, description: '속성 삭제 완료' })
  async deleteRelationProperty(
    @Param('id') id: string,
    @Param('key') key: string,
  ): Promise<{ success: boolean }> {
    await this.knowledgeGraphService.deleteRelationProperty(id, key)
    return { success: true }
  }
}
