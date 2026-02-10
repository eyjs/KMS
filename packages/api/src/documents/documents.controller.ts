import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Res,
  StreamableFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { DocumentsService } from './documents.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import {
  DocumentListQueryDto,
  CreateDocumentBodyDto,
  UpdateDocumentDto,
  TransitionLifecycleDto,
  BulkTransitionDto,
  IssueQueryDto,
} from './dto/documents.dto'
import type { UserRole } from '@kms/shared'

interface AuthRequest {
  user: { sub: string; email: string; role: UserRole }
}

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DocumentsController {
  private readonly storagePath: string

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly config: ConfigService,
  ) {
    this.storagePath = path.resolve(
      this.config.get('STORAGE_PATH', './storage/originals'),
    )
  }

  @Post()
  @ApiOperation({ summary: '문서 생성 (파일 업로드 또는 메타데이터만)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: CreateDocumentBodyDto,
    @Request() req: AuthRequest,
  ) {
    if (!file && !body.title) {
      throw new BadRequestException('파일 또는 제목 중 하나는 필수입니다')
    }

    let classifications: Record<string, string>
    try {
      const parsed: unknown = JSON.parse(body.classifications)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error()
      }
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          throw new Error()
        }
      }
      classifications = parsed as Record<string, string>
    } catch {
      throw new BadRequestException('classifications은 유효한 JSON 객체여야 합니다')
    }

    return this.documentsService.create(
      { domain: body.domain, classifications, securityLevel: body.securityLevel, title: body.title, validUntil: body.validUntil },
      file ?? null,
      req.user.sub,
    )
  }

  @Patch(':id/file')
  @ApiOperation({ summary: '문서에 파일 첨부 (나중에 연결)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async attachFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthRequest,
  ) {
    if (!file) {
      throw new BadRequestException('파일이 필요합니다')
    }
    return this.documentsService.attachFile(id, file, req.user.sub, req.user.role)
  }

  @Get()
  @ApiOperation({ summary: '문서 목록 조회' })
  async findAll(@Query() query: DocumentListQueryDto, @Request() req: AuthRequest) {
    return this.documentsService.findAll(query, req.user.role)
  }

  // 정적 라우트는 :id 파라미터 라우트보다 먼저 선언해야 함
  @Get('stats')
  @ApiOperation({ summary: '전체 문서 통계 (대시보드용)' })
  async getStats(@Request() req: AuthRequest) {
    return this.documentsService.getStats(req.user.role)
  }

  @Get('recent')
  @ApiOperation({ summary: '최근 활동 목록' })
  async getRecent(
    @Query('limit') limit?: string,
    @Request() req?: AuthRequest,
  ) {
    return this.documentsService.getRecent(
      parseInt(limit ?? '10', 10),
      req?.user.role ?? 'VIEWER',
    )
  }

  @Get('counts')
  @ApiOperation({ summary: '분류별 문서 수' })
  async getCounts(
    @Query('domain') domain: string,
    @Query('groupBy') groupBy: string,
    @Request() req?: AuthRequest,
  ) {
    return this.documentsService.getCounts(domain, groupBy, req?.user.role ?? 'VIEWER')
  }

  @Get('issues')
  @ApiOperation({ summary: '문제 문서 목록 (대시보드용)' })
  async getIssues(
    @Query() query: IssueQueryDto,
    @Request() req: AuthRequest,
  ) {
    return this.documentsService.getIssueDocuments(
      query.type,
      query.page ?? 1,
      query.size ?? 10,
      req.user.role,
    )
  }

  @Get('issues/counts')
  @ApiOperation({ summary: '문제 유형별 건수 (대시보드용)' })
  async getIssueCounts(@Request() req: AuthRequest) {
    return this.documentsService.getIssueCounts(req.user.role)
  }

  @Get('check-duplicate')
  @ApiOperation({ summary: '동일 분류의 ACTIVE 문서 존재 여부 확인' })
  async checkDuplicate(
    @Query('domain') domain: string,
    @Query('classifications') classifications: string,
    @Request() req: AuthRequest,
  ) {
    if (!domain) throw new BadRequestException('domain은 필수입니다')
    let parsed: Record<string, string>
    try {
      const raw: unknown = JSON.parse(classifications)
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error()
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof key !== 'string' || typeof value !== 'string') throw new Error()
      }
      parsed = raw as Record<string, string>
    } catch {
      throw new BadRequestException('classifications은 유효한 JSON 객체여야 합니다')
    }
    return this.documentsService.checkDuplicate(domain, parsed, req.user.role)
  }

  @Get('search')
  @ApiOperation({ summary: '통합 검색' })
  async search(
    @Query('q') q?: string,
    @Query('domain') domain?: string,
    @Query('lifecycle') lifecycle?: string,
    @Query('classifications') classifications?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Request() req?: AuthRequest,
  ) {
    return this.documentsService.search(
      { q, domain, lifecycle, classifications, page: parseInt(page ?? '1', 10), size: parseInt(size ?? '20', 10) },
      req?.user.role ?? 'VIEWER',
    )
  }

  @Get(':id')
  @ApiOperation({ summary: '문서 상세 조회' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.documentsService.findOne(id, req.user.role)
  }

  @Put(':id')
  @ApiOperation({ summary: '문서 수정 (낙관적 잠금)' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateDocumentDto,
    @Request() req: AuthRequest,
  ) {
    return this.documentsService.update(id, body, req.user.sub, req.user.role)
  }

  @Patch('bulk/lifecycle')
  @ApiOperation({ summary: '일괄 라이프사이클 전환' })
  async bulkTransitionLifecycle(
    @Body() body: BulkTransitionDto,
    @Request() req: AuthRequest,
  ) {
    return this.documentsService.bulkTransitionLifecycle(body.ids, body.lifecycle, req.user.sub, req.user.role)
  }

  @Patch(':id/lifecycle')
  @ApiOperation({ summary: '라이프사이클 전환' })
  async transitionLifecycle(
    @Param('id') id: string,
    @Body() body: TransitionLifecycleDto,
    @Request() req: AuthRequest,
  ) {
    return this.documentsService.transitionLifecycle(id, body.lifecycle, req.user.sub, req.user.role)
  }

  @Delete(':id')
  @Roles('REVIEWER')
  @ApiOperation({ summary: '문서 논리 삭제 (팀장 이상)' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.documentsService.softDelete(id, req.user.sub, req.user.role)
    return { message: '삭제되었습니다' }
  }

  @Get(':id/history')
  @ApiOperation({ summary: '문서 변경 이력' })
  async getHistory(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.documentsService.getHistory(id, req.user.role)
  }

  @Get(':id/file')
  @ApiOperation({ summary: '파일 다운로드' })
  async downloadFile(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.serveFile(id, req.user.role, res, 'attachment')
  }

  @Get(':id/preview')
  @ApiOperation({ summary: '파일 인라인 미리보기 (뷰어용)' })
  async previewFile(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.serveFile(id, req.user.role, res, 'inline')
  }

  private readonly MIME_MAP: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.md': 'text/markdown; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
  }

  private async serveFile(
    id: string,
    role: UserRole,
    res: Response,
    disposition: 'attachment' | 'inline',
  ): Promise<StreamableFile> {
    const doc = await this.documentsService.findOneInternal(id, role)
    if (!doc.filePath) {
      throw new NotFoundException('파일 경로를 찾을 수 없습니다')
    }

    const resolved = path.resolve(doc.filePath)
    if (!resolved.startsWith(this.storagePath)) {
      throw new BadRequestException('허용되지 않는 파일 경로입니다')
    }

    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('파일이 존재하지 않습니다')
    }

    const stream = fs.createReadStream(resolved)
    const ext = path.extname(doc.fileName ?? '').toLowerCase()
    const contentType = this.MIME_MAP[ext] ?? 'application/octet-stream'
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(doc.fileName ?? 'download')}"`,
    })
    return new StreamableFile(stream)
  }
}
