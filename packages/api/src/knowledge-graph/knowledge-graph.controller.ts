import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger'
import { KnowledgeGraphService } from './knowledge-graph.service'
import { ExploreGraphQueryDto } from './dto/knowledge-graph.dto'
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard'
import type { UserRole, RelationType, KnowledgeGraphResponse } from '@kms/shared'

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
}
