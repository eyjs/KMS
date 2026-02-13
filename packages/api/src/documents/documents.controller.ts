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
  UploadedFiles,
  Request,
  Res,
  StreamableFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
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
  UploadDocumentBodyDto,
  UpdateDocumentDto,
  TransitionLifecycleDto,
  BulkTransitionDto,
  IssueQueryDto,
} from './dto/documents.dto'
import type { UserRole, SecurityLevel } from '@kms/shared'

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
  @ApiOperation({ summary: '문서 업로드 (파일 필수)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadDocumentBodyDto,
    @Request() req: AuthRequest,
  ) {
    return this.documentsService.create(
      { securityLevel: body.securityLevel as SecurityLevel | undefined, validUntil: body.validUntil },
      file ?? null,
      req.user.sub,
      req.user.role,
    )
  }

  @Post('bulk-upload')
  @ApiOperation({ summary: '대량 업로드 (여러 파일 동시)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20))
  async bulkCreate(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadDocumentBodyDto,
    @Request() req: AuthRequest,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('최소 1개 파일이 필요합니다')
    }
    return this.documentsService.bulkCreate(
      files,
      body.securityLevel as SecurityLevel | undefined,
      req.user.sub,
      req.user.role,
    )
  }

  @Patch(':id/file')
  @ApiOperation({ summary: '문서에 파일 첨부' })
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
      req!.user.role,
    )
  }

  @Get('orphans')
  @ApiOperation({ summary: '미배치 문서 목록' })
  async getOrphans(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Request() req?: AuthRequest,
  ) {
    return this.documentsService.findOrphans(
      req!.user.role,
      parseInt(page ?? '1', 10),
      parseInt(size ?? '20', 10),
    )
  }

  @Get('my')
  @ApiOperation({ summary: '내가 올린 문서 목록' })
  async getMyDocuments(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('orphan') orphan?: string,
    @Request() req?: AuthRequest,
  ) {
    const orphanFilter = orphan === 'true' ? true : orphan === 'false' ? false : null
    return this.documentsService.findMyDocuments(
      req!.user.sub,
      req!.user.role,
      parseInt(page ?? '1', 10),
      parseInt(size ?? '20', 10),
      orphanFilter,
    )
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

  @Get('audit/log')
  @Roles('ADMIN')
  @ApiOperation({ summary: '감사 로그 조회 (ADMIN)' })
  async getAuditLog(
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.documentsService.getAuditLog({
      action,
      userId,
      dateFrom,
      dateTo,
      page: parseInt(page ?? '1', 10),
      size: parseInt(size ?? '20', 10),
    })
  }

  @Get('audit/stats')
  @Roles('ADMIN')
  @ApiOperation({ summary: '감사 통계 (ADMIN)' })
  async getAuditStats() {
    return this.documentsService.getAuditStats()
  }

  @Get('search')
  @ApiOperation({ summary: '통합 검색' })
  async search(
    @Query('q') q?: string,
    @Query('domain') domain?: string,
    @Query('lifecycle') lifecycle?: string,
    @Query('orphan') orphan?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Request() req?: AuthRequest,
  ) {
    return this.documentsService.search(
      {
        q,
        domain,
        lifecycle,
        orphan: orphan === 'true',
        page: parseInt(page ?? '1', 10),
        size: parseInt(size ?? '20', 10),
      },
      req!.user.role,
    )
  }

  @Get(':id')
  @ApiOperation({ summary: '문서 상세 조회' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    // 열람 기록 비동기 (실패해도 무시)
    this.documentsService.recordView(id, req.user.sub).catch(() => {})
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
  @ApiOperation({ summary: '문서 논리 삭제 (검토자 이상)' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.documentsService.softDelete(id, req.user.sub, req.user.role)
    return { message: '삭제되었습니다' }
  }

  @Get(':id/history')
  @ApiOperation({ summary: '문서 변경 이력' })
  async getHistory(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.documentsService.getHistory(id, req.user.role)
  }

  @Get(':id/versions')
  @ApiOperation({ summary: '문서 버전 이력' })
  async getVersions(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.documentsService.getVersions(id, req.user.role)
  }

  @Get(':id/versions/:versionId/file')
  @ApiOperation({ summary: '이전 버전 파일 다운로드' })
  async downloadVersionFile(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.serveVersionFile(id, versionId, req.user.role, res, 'attachment')
  }

  @Get(':id/versions/:versionId/preview')
  @ApiOperation({ summary: '이전 버전 미리보기' })
  async previewVersionFile(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.serveVersionFile(id, versionId, req.user.role, res, 'inline')
  }

  @Get(':id/file')
  @ApiOperation({ summary: '파일 다운로드' })
  async downloadFile(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 다운로드 기록 비동기 (실패해도 무시)
    this.documentsService.recordDownload(id, req.user.sub).catch(() => {})
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

  private async serveVersionFile(
    docId: string,
    versionId: string,
    role: UserRole,
    res: Response,
    disposition: 'attachment' | 'inline',
  ): Promise<StreamableFile> {
    const version = await this.documentsService.findVersionInternal(docId, versionId, role)
    if (!version.filePath) {
      throw new NotFoundException('파일 경로를 찾을 수 없습니다')
    }

    const resolved = path.resolve(version.filePath)
    if (!resolved.startsWith(this.storagePath)) {
      throw new BadRequestException('허용되지 않는 파일 경로입니다')
    }

    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('파일이 존재하지 않습니다')
    }

    const stream = fs.createReadStream(resolved)
    const ext = path.extname(version.fileName ?? '').toLowerCase()
    const contentType = this.MIME_MAP[ext] ?? 'application/octet-stream'
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(version.fileName ?? 'download')}"`,
    })
    return new StreamableFile(stream)
  }
}
