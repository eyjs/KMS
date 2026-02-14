import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SecurityLevelGuard } from '../auth/guards/security-level.guard'
import { CategoriesService } from '../categories/categories.service'
import { WebhooksService } from '../webhooks/webhooks.service'
import { DocumentsQueryService } from './documents-query.service'
import { DocumentsAuditService } from './documents-audit.service'
import { DocumentsExternalService, AuthUser } from './documents-external.service'
import { DocumentsRelationsService } from './documents-relations.service'
import { LIFECYCLE_TRANSITIONS } from '@kms/shared'
import type { Lifecycle, SecurityLevel, UserRole, RelationType, WebhookEvent } from '@kms/shared'
import * as crypto from 'crypto'
import * as fs from 'fs'

// Re-export for backward compatibility
export { AuthUser } from './documents-external.service'

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    @Inject(forwardRef(() => WebhooksService))
    private readonly webhooksService: WebhooksService,
    private readonly queryService: DocumentsQueryService,
    private readonly auditService: DocumentsAuditService,
    private readonly externalService: DocumentsExternalService,
    private readonly relationsService: DocumentsRelationsService,
  ) {}

  // ============================================================
  // 쿼리 서비스 위임 (Proxy Methods)
  // ============================================================

  findAll(...args: Parameters<DocumentsQueryService['findAll']>) {
    return this.queryService.findAll(...args)
  }

  findMyDocuments(...args: Parameters<DocumentsQueryService['findMyDocuments']>) {
    return this.queryService.findMyDocuments(...args)
  }

  findOrphans(...args: Parameters<DocumentsQueryService['findOrphans']>) {
    return this.queryService.findOrphans(...args)
  }

  search(...args: Parameters<DocumentsQueryService['search']>) {
    return this.queryService.search(...args)
  }

  getStats(...args: Parameters<DocumentsQueryService['getStats']>) {
    return this.queryService.getStats(...args)
  }

  getIssueDocuments(...args: Parameters<DocumentsQueryService['getIssueDocuments']>) {
    return this.queryService.getIssueDocuments(...args)
  }

  getIssueCounts(...args: Parameters<DocumentsQueryService['getIssueCounts']>) {
    return this.queryService.getIssueCounts(...args)
  }

  // ============================================================
  // 감사 서비스 위임 (Proxy Methods)
  // ============================================================

  getRecent(...args: Parameters<DocumentsAuditService['getRecent']>) {
    return this.auditService.getRecent(...args)
  }

  recordView(...args: Parameters<DocumentsAuditService['recordView']>) {
    return this.auditService.recordView(...args)
  }

  recordDownload(...args: Parameters<DocumentsAuditService['recordDownload']>) {
    return this.auditService.recordDownload(...args)
  }

  getAuditLog(...args: Parameters<DocumentsAuditService['getAuditLog']>) {
    return this.auditService.getAuditLog(...args)
  }

  getAuditStats() {
    return this.auditService.getAuditStats()
  }

  // ============================================================
  // 외부 API 서비스 위임 (Proxy Methods)
  // ============================================================

  getAccessibleDocumentIds(...args: Parameters<DocumentsExternalService['getAccessibleDocumentIds']>) {
    return this.externalService.getAccessibleDocumentIds(...args)
  }

  getAccessibleDocumentsMetadata(...args: Parameters<DocumentsExternalService['getAccessibleDocumentsMetadata']>) {
    return this.externalService.getAccessibleDocumentsMetadata(...args)
  }

  canAccessDocument(...args: Parameters<DocumentsExternalService['canAccessDocument']>) {
    return this.externalService.canAccessDocument(...args)
  }

  getChanges(...args: Parameters<DocumentsExternalService['getChanges']>) {
    return this.externalService.getChanges(...args)
  }

  getBulkMetadata(...args: Parameters<DocumentsExternalService['getBulkMetadata']>) {
    return this.externalService.getBulkMetadata(...args)
  }

  // ============================================================
  // 연관 문서 서비스 위임 (Proxy Methods)
  // ============================================================

  findRelatedDocuments(...args: Parameters<DocumentsRelationsService['findRelatedDocuments']>) {
    return this.relationsService.findRelatedDocuments(...args)
  }

  // ============================================================
  // 핵심 CRUD
  // ============================================================

  async create(
    data: { securityLevel?: SecurityLevel; validUntil?: string },
    file: Express.Multer.File | null,
    userId: string,
    userRole: UserRole,
  ) {
    if (!file) {
      throw new BadRequestException('파일이 필요합니다')
    }

    const originalName = this.decodeFileName(file.originalname)
    const ext = originalName.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다')
    }

    const fileHash = this.calculateFileHash(file.path)
    const existing = await this.checkFileHashDuplicate(fileHash)
    if (existing) {
      try { fs.unlinkSync(file.path) } catch { /* ignore */ }
      const canSee = SecurityLevelGuard.canAccess(userRole, existing.securityLevel as SecurityLevel)
      throw new ConflictException({
        message: '동일한 파일이 이미 존재합니다',
        ...(canSee && {
          existingDocumentId: existing.id,
          existingDocCode: existing.docCode,
          existingFileName: existing.fileName,
        }),
      })
    }

    const createDocument = async (docCode: string) =>
      this.prisma.document.create({
        data: {
          docCode,
          lifecycle: 'DRAFT',
          securityLevel: data.securityLevel ?? 'INTERNAL',
          filePath: file.path,
          fileName: originalName,
          fileType: ext,
          fileSize: file.size,
          fileHash,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          createdById: userId,
          updatedById: userId,
        },
      })

    let document: Awaited<ReturnType<typeof createDocument>> | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        document = await createDocument(await this.generateDocCode())
        break
      } catch (error: unknown) {
        const isUniqueViolation = typeof error === 'object' && error !== null
          && 'code' in error && (error as { code: string }).code === 'P2002'
        if (!isUniqueViolation || attempt === 2) throw error
      }
    }
    if (!document) throw new BadRequestException('문서 코드 생성에 실패했습니다')

    await this.prisma.documentHistory.create({
      data: { documentId: document.id, action: 'CREATE', changes: { fileName: originalName }, userId },
    })

    this.webhooksService.dispatch('document.created' as WebhookEvent, {
      documentId: document.id,
      docCode: document.docCode,
      fileName: originalName,
      securityLevel: document.securityLevel,
      lifecycle: document.lifecycle,
    })

    return this.queryService.formatDocument(document)
  }

  async bulkCreate(
    files: Express.Multer.File[],
    securityLevel: SecurityLevel | undefined,
    userId: string,
    userRole: UserRole,
  ) {
    const results: Array<{
      fileName: string
      success: boolean
      documentId?: string
      docCode?: string | null
      error?: string
      existingDocumentId?: string
    }> = []

    for (const file of files) {
      try {
        const doc = await this.create({ securityLevel }, file, userId, userRole)
        results.push({ fileName: file.originalname, success: true, documentId: doc.id, docCode: doc.docCode })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류'
        const conflictData = err instanceof ConflictException
          ? (err.getResponse() as Record<string, unknown>)
          : undefined
        results.push({
          fileName: file.originalname,
          success: false,
          error: message,
          existingDocumentId: conflictData?.existingDocumentId as string | undefined,
        })
      }
    }

    return { succeeded: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length, results }
  }

  async findOne(
    id: string,
    userRole: UserRole,
    authUser?: AuthUser,
    options?: { includeRelations?: boolean; relationDepth?: number; relationTypes?: RelationType[]; relationLimit?: number },
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
      include: {
        _count: { select: { placements: true } },
        placements: {
          include: {
            domain: { select: { displayName: true } },
            category: { select: { name: true, code: true } },
            user: { select: { name: true } },
          },
        },
      },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException(`이 문서는 ${doc.securityLevel} 등급입니다. 접근 권한이 없습니다.`)
    }

    if (authUser?.isApiKey) {
      if (!authUser.groupIds || authUser.groupIds.length === 0) {
        throw new ForbiddenException('API Key는 권한 그룹 소속이 필요합니다')
      }
      const canAccess = await this.externalService.canApiKeyAccessDocument(
        authUser.groupIds,
        doc.placements.map((p) => ({ categoryId: p.categoryId })),
      )
      if (!canAccess) {
        throw new ForbiddenException('폴더 접근 권한이 없습니다')
      }
    }

    const result: Record<string, unknown> = {
      ...this.queryService.formatDocument(doc),
      placements: doc.placements.map((p) => ({
        id: p.id,
        documentId: p.documentId,
        domainCode: p.domainCode,
        domainName: p.domain.displayName,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        categoryCode: p.category?.code ?? null,
        placedBy: p.placedBy,
        placedByName: p.user?.name ?? null,
        placedAt: p.placedAt.toISOString(),
        alias: p.alias,
        note: p.note,
      })),
    }

    if (options?.includeRelations) {
      result.relations = await this.findRelatedDocuments(id, userRole, authUser, {
        depth: options.relationDepth ?? 1,
        types: options.relationTypes,
        limit: options.relationLimit ?? 50,
      })
    }

    return result
  }

  async findOneInternal(id: string, userRole: UserRole, authUser?: AuthUser) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
      include: { placements: { select: { categoryId: true } } },
    })

    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')

    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    if (authUser?.isApiKey) {
      if (!authUser.groupIds || authUser.groupIds.length === 0) {
        throw new ForbiddenException('API Key는 권한 그룹 소속이 필요합니다')
      }
      const canAccess = await this.externalService.canApiKeyAccessDocument(authUser.groupIds, doc.placements)
      if (!canAccess) {
        throw new ForbiddenException('폴더 접근 권한이 없습니다')
      }
    }

    return doc
  }

  async getHistory(id: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({ where: { id, isDeleted: false } })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }
    return this.auditService.getHistory(id)
  }

  // ============================================================
  // 파일 관리
  // ============================================================

  async attachFile(id: string, file: Express.Multer.File, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({ where: { id, isDeleted: false } })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const originalName = this.decodeFileName(file.originalname)
    const ext = originalName.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다')
    }

    const fileHash = this.calculateFileHash(file.path)
    const isReplace = !!doc.filePath
    const newMinor = isReplace ? doc.versionMinor + 1 : doc.versionMinor

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isReplace && doc.filePath && doc.fileName && doc.fileType && doc.fileSize) {
        await tx.documentVersion.create({
          data: {
            documentId: id,
            versionMajor: doc.versionMajor,
            versionMinor: doc.versionMinor,
            filePath: doc.filePath,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            fileHash: doc.fileHash ?? '',
            uploadedById: doc.updatedById ?? doc.createdById,
          },
        })
      }

      const result = await tx.document.update({
        where: { id },
        data: {
          filePath: file.path,
          fileName: originalName,
          fileType: ext,
          fileSize: file.size,
          fileHash,
          versionMinor: newMinor,
          updatedBy: { connect: { id: userId } },
        },
      })

      await tx.documentHistory.create({
        data: {
          documentId: id,
          action: isReplace ? 'FILE_REPLACE' : 'FILE_ATTACH',
          changes: {
            fileName: originalName,
            fileType: ext,
            ...(isReplace && {
              previousVersion: `v${doc.versionMajor}.${doc.versionMinor}`,
              newVersion: `v${doc.versionMajor}.${newMinor}`,
              previousFileName: doc.fileName,
            }),
          },
          userId,
        },
      })

      return result
    })

    this.webhooksService.dispatch('document.file_uploaded' as WebhookEvent, {
      documentId: id,
      docCode: updated.docCode,
      fileName: originalName,
      fileType: ext,
      isReplace,
      version: `v${updated.versionMajor}.${updated.versionMinor}`,
    })

    return this.queryService.formatDocument(updated)
  }

  // ============================================================
  // 수정/삭제/라이프사이클
  // ============================================================

  async update(
    id: string,
    data: { securityLevel?: SecurityLevel; validUntil?: string | null; fileName?: string; rowVersion: number },
    userId: string,
    userRole: UserRole,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
      include: { _count: { select: { placements: true } } },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }
    if (doc.rowVersion !== data.rowVersion) {
      throw new ConflictException('다른 사용자가 수정했습니다. 새로고침 후 다시 시도하세요.')
    }
    if (data.securityLevel && data.securityLevel !== doc.securityLevel && userRole !== 'ADMIN') {
      throw new ForbiddenException('보안 등급 변경은 ADMIN만 가능합니다')
    }
    if (data.fileName && data.fileName !== doc.fileName) {
      if (doc.createdById !== userId && userRole !== 'ADMIN') {
        throw new ForbiddenException('원본 파일명은 업로더 또는 관리자만 변경할 수 있습니다')
      }
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        updatedBy: { connect: { id: userId } },
        ...(data.securityLevel && { securityLevel: data.securityLevel }),
        ...(data.fileName && { fileName: data.fileName }),
        ...(data.validUntil !== undefined && { validUntil: data.validUntil ? new Date(data.validUntil) : null }),
      },
      include: { _count: { select: { placements: true } } },
    })

    await this.prisma.documentHistory.create({
      data: { documentId: id, action: 'UPDATE', changes: { securityLevel: data.securityLevel, fileName: data.fileName }, userId },
    })

    this.webhooksService.dispatch('document.updated' as WebhookEvent, {
      documentId: id,
      docCode: updated.docCode,
      fileName: updated.fileName,
      changes: { securityLevel: data.securityLevel, fileName: data.fileName, validUntil: data.validUntil },
    })

    return this.queryService.formatDocument(updated)
  }

  async transitionLifecycle(id: string, lifecycle: Lifecycle, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({ where: { id, isDeleted: false } })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const allowed = LIFECYCLE_TRANSITIONS[doc.lifecycle as Lifecycle]
    if (!allowed || !allowed.includes(lifecycle)) {
      throw new BadRequestException(`${doc.lifecycle} → ${lifecycle} 전환은 허용되지 않습니다`)
    }

    const versionBump = doc.lifecycle === 'DRAFT' && lifecycle === 'ACTIVE'
      ? { versionMajor: doc.versionMajor + 1, versionMinor: 0 }
      : {}

    const updated = await this.prisma.document.update({
      where: { id },
      data: { lifecycle, ...versionBump, updatedBy: { connect: { id: userId } } },
    })

    await this.prisma.documentHistory.create({
      data: {
        documentId: id,
        action: 'LIFECYCLE_CHANGE',
        changes: {
          from: doc.lifecycle,
          to: lifecycle,
          ...(versionBump.versionMajor !== undefined && { newVersion: `v${versionBump.versionMajor}.0` }),
        },
        userId,
      },
    })

    this.webhooksService.dispatch('document.lifecycle_changed' as WebhookEvent, {
      documentId: id,
      docCode: updated.docCode,
      fileName: updated.fileName,
      fromLifecycle: doc.lifecycle,
      toLifecycle: lifecycle,
    })

    return this.queryService.formatDocument(updated)
  }

  async bulkTransitionLifecycle(ids: string[], lifecycle: Lifecycle, userId: string, userRole: UserRole) {
    const results: Array<{ id: string; success: boolean; error?: string }> = []
    for (const id of ids) {
      try {
        await this.transitionLifecycle(id, lifecycle, userId, userRole)
        results.push({ id, success: true })
      } catch (err: unknown) {
        results.push({ id, success: false, error: err instanceof Error ? err.message : '알 수 없는 오류' })
      }
    }
    return { succeeded: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length, results }
  }

  async softDelete(id: string, userId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({ where: { id, isDeleted: false } })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    await this.prisma.document.update({ where: { id }, data: { isDeleted: true, updatedBy: { connect: { id: userId } } } })
    await this.prisma.documentHistory.create({ data: { documentId: id, action: 'DELETE', userId } })

    this.webhooksService.dispatch('document.deleted' as WebhookEvent, {
      documentId: id,
      docCode: doc.docCode,
      fileName: doc.fileName,
    })
  }

  // ============================================================
  // 버전 관리
  // ============================================================

  async getVersions(docId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({ where: { id: docId, isDeleted: false } })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: docId },
      orderBy: [{ versionMajor: 'desc' }, { versionMinor: 'desc' }],
      include: { uploadedBy: { select: { name: true } } },
    })

    return versions.map((v) => ({
      id: v.id,
      documentId: v.documentId,
      versionMajor: v.versionMajor,
      versionMinor: v.versionMinor,
      fileName: v.fileName,
      fileType: v.fileType,
      fileSize: Number(v.fileSize),
      fileHash: v.fileHash,
      uploadedByName: v.uploadedBy?.name ?? null,
      createdAt: v.createdAt.toISOString(),
    }))
  }

  async findVersionInternal(docId: string, versionId: string, userRole: UserRole) {
    const doc = await this.prisma.document.findFirst({ where: { id: docId, isDeleted: false } })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    if (!SecurityLevelGuard.canAccess(userRole, doc.securityLevel as SecurityLevel)) {
      throw new ForbiddenException('접근 권한이 없습니다')
    }

    const version = await this.prisma.documentVersion.findFirst({ where: { id: versionId, documentId: docId } })
    if (!version) throw new NotFoundException('해당 버전을 찾을 수 없습니다')
    return version
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  private calculateFileHash(filePath: string): string {
    const buffer = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  private decodeFileName(originalname: string): string {
    let name = Buffer.from(originalname, 'latin1').toString('utf8')
    if (/%[0-9A-Fa-f]{2}/.test(name)) {
      try { name = decodeURIComponent(name) } catch { /* ignore */ }
    }
    return name
  }

  private async checkFileHashDuplicate(fileHash: string, excludeId?: string) {
    const docWhere: Record<string, unknown> = { fileHash, isDeleted: false }
    if (excludeId) docWhere.id = { not: excludeId }

    const existing = await this.prisma.document.findFirst({
      where: docWhere,
      select: { id: true, docCode: true, fileName: true, securityLevel: true },
    })
    if (existing) return existing

    const versionMatch = await this.prisma.documentVersion.findFirst({
      where: { fileHash },
      select: { document: { select: { id: true, docCode: true, fileName: true, securityLevel: true } } },
    })
    return versionMatch?.document ?? null
  }

  private async generateDocCode(): Promise<string> {
    const now = new Date()
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`
    const prefix = `DOC-${yymm}-`
    const last = await this.prisma.document.findFirst({
      where: { docCode: { startsWith: prefix } },
      orderBy: { docCode: 'desc' },
      select: { docCode: true },
    })
    const seq = last?.docCode ? parseInt(last.docCode.slice(prefix.length), 10) + 1 : 1
    return `${prefix}${String(seq).padStart(3, '0')}`
  }
}
