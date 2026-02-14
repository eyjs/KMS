import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CategoriesService } from '../categories/categories.service'
import { DocumentsQueryService } from './documents-query.service'
import { SecurityLevelGuard } from '../auth/guards/security-level.guard'
import type { SecurityLevel, UserRole } from '@kms/shared'

/** 인증된 사용자 정보 (JWT 또는 API Key) */
export interface AuthUser {
  sub: string
  role: UserRole
  isApiKey?: boolean
  groupIds?: string[]
}

@Injectable()
export class DocumentsExternalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly queryService: DocumentsQueryService,
  ) {}

  /**
   * 현재 사용자(또는 API Key)가 접근 가능한 문서 ID 목록 반환
   * RAG 벡터 검색 시 권한 필터로 사용
   */
  async getAccessibleDocumentIds(authUser: AuthUser): Promise<string[]> {
    const allowedLevels = this.queryService.getAllowedLevels(authUser.role)

    // 내부 사용자: 신원등급 범위 내 모든 문서
    if (!authUser.isApiKey) {
      const docs = await this.prisma.document.findMany({
        where: { isDeleted: false, securityLevel: { in: allowedLevels } },
        select: { id: true },
      })
      return docs.map((d) => d.id)
    }

    // 외부 API Key: 그룹에 지정된 폴더 범위 내 문서만
    if (!authUser.groupIds || authUser.groupIds.length === 0) {
      return []
    }

    const accessibleFolderIds = await this.categoriesService.getAccessibleFolderIds(authUser.groupIds)
    if (accessibleFolderIds.length === 0) {
      return []
    }

    const docs = await this.prisma.document.findMany({
      where: {
        isDeleted: false,
        securityLevel: { in: allowedLevels },
        placements: { some: { categoryId: { in: accessibleFolderIds } } },
      },
      select: { id: true },
    })
    return docs.map((d) => d.id)
  }

  /**
   * 접근 가능 문서 메타데이터 반환 (캐싱/인덱싱용)
   */
  async getAccessibleDocumentsMetadata(authUser: AuthUser) {
    const allowedLevels = this.queryService.getAllowedLevels(authUser.role)

    let whereCondition: Prisma.DocumentWhereInput = {
      isDeleted: false,
      securityLevel: { in: allowedLevels },
    }

    if (authUser.isApiKey) {
      if (!authUser.groupIds || authUser.groupIds.length === 0) {
        return { documents: [] }
      }

      const accessibleFolderIds = await this.categoriesService.getAccessibleFolderIds(authUser.groupIds)
      if (accessibleFolderIds.length === 0) {
        return { documents: [] }
      }

      whereCondition = {
        ...whereCondition,
        placements: { some: { categoryId: { in: accessibleFolderIds } } },
      }
    }

    const docs = await this.prisma.document.findMany({
      where: whereCondition,
      select: {
        id: true,
        docCode: true,
        fileName: true,
        securityLevel: true,
        lifecycle: true,
        placements: {
          select: {
            domainCode: true,
            categoryId: true,
            category: { select: { code: true, name: true } },
          },
        },
      },
    })

    return {
      documents: docs.map((d) => ({
        id: d.id,
        docCode: d.docCode,
        fileName: d.fileName,
        securityLevel: d.securityLevel,
        lifecycle: d.lifecycle,
        folders: d.placements.map((p) => ({
          domainCode: p.domainCode,
          categoryId: p.categoryId,
          categoryCode: p.category?.code ?? null,
          categoryName: p.category?.name ?? null,
        })),
      })),
    }
  }

  /**
   * 특정 문서 접근 가능 여부 확인 (단건)
   */
  async canAccessDocument(docId: string, authUser: AuthUser): Promise<{ canAccess: boolean; reason?: string }> {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, isDeleted: false },
      include: { placements: { select: { categoryId: true } } },
    })

    if (!doc) {
      return { canAccess: false, reason: '문서를 찾을 수 없습니다' }
    }

    if (!SecurityLevelGuard.canAccess(authUser.role, doc.securityLevel as SecurityLevel)) {
      return { canAccess: false, reason: '신원 등급이 부족합니다' }
    }

    if (!authUser.isApiKey) {
      return { canAccess: true }
    }

    if (!authUser.groupIds || authUser.groupIds.length === 0) {
      return { canAccess: false, reason: 'API Key는 권한 그룹 소속이 필요합니다' }
    }

    const canAccess = await this.canApiKeyAccessDocument(authUser.groupIds, doc.placements)
    if (!canAccess) {
      return { canAccess: false, reason: '폴더 접근 권한이 없습니다' }
    }

    return { canAccess: true }
  }

  /**
   * 마지막 동기화 이후 변경된 문서 목록 반환
   */
  async getChanges(since: Date, authUser: AuthUser, includeDeleted: boolean = true) {
    const allowedLevels = this.queryService.getAllowedLevels(authUser.role)

    let accessibleFolderIds: number[] | null = null
    if (authUser.isApiKey) {
      if (!authUser.groupIds || authUser.groupIds.length === 0) {
        return { created: [], updated: [], deleted: [], syncedAt: new Date().toISOString() }
      }
      accessibleFolderIds = await this.categoriesService.getAccessibleFolderIds(authUser.groupIds)
      if (accessibleFolderIds.length === 0) {
        return { created: [], updated: [], deleted: [], syncedAt: new Date().toISOString() }
      }
    }

    const baseWhere: Prisma.DocumentWhereInput = {
      securityLevel: { in: allowedLevels },
      ...(accessibleFolderIds && {
        placements: { some: { categoryId: { in: accessibleFolderIds } } },
      }),
    }

    const created = await this.prisma.document.findMany({
      where: { ...baseWhere, isDeleted: false, createdAt: { gt: since } },
      select: { id: true, docCode: true, fileName: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const updated = await this.prisma.document.findMany({
      where: { ...baseWhere, isDeleted: false, createdAt: { lte: since }, updatedAt: { gt: since } },
      select: { id: true, docCode: true, fileName: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
    })

    let deleted: Array<{ id: string; docCode: string | null; fileName: string | null }> = []
    if (includeDeleted) {
      deleted = await this.prisma.document.findMany({
        where: { securityLevel: { in: allowedLevels }, isDeleted: true, updatedAt: { gt: since } },
        select: { id: true, docCode: true, fileName: true },
      })
    }

    return {
      created: created.map((d) => ({ id: d.id, docCode: d.docCode, fileName: d.fileName })),
      updated: updated.map((d) => ({ id: d.id, docCode: d.docCode, fileName: d.fileName })),
      deleted: deleted.map((d) => ({ id: d.id, docCode: d.docCode, fileName: d.fileName })),
      syncedAt: new Date().toISOString(),
    }
  }

  /**
   * 벌크 메타데이터 조회 (N+1 방지)
   */
  async getBulkMetadata(ids: string[], authUser: AuthUser, includeRelations: boolean = false) {
    const allowedLevels = this.queryService.getAllowedLevels(authUser.role)

    const docs = await this.prisma.document.findMany({
      where: { id: { in: ids }, isDeleted: false, securityLevel: { in: allowedLevels } },
      include: {
        _count: { select: { placements: true } },
        placements: {
          select: {
            domainCode: true,
            categoryId: true,
            category: { select: { code: true, name: true } },
          },
        },
      },
    })

    let filteredDocs = docs
    if (authUser.isApiKey && authUser.groupIds && authUser.groupIds.length > 0) {
      const accessibleFolderIds = await this.categoriesService.getAccessibleFolderIds(authUser.groupIds)
      filteredDocs = docs.filter((d) =>
        d.placements.some((p) => p.categoryId && accessibleFolderIds.includes(p.categoryId)),
      )
    }

    const results = filteredDocs.map((doc) => ({
      ...this.queryService.formatDocument(doc),
      placements: doc.placements.map((p) => ({
        domainCode: p.domainCode,
        categoryId: p.categoryId,
        categoryCode: p.category?.code ?? null,
        categoryName: p.category?.name ?? null,
      })),
    }))

    return {
      documents: results,
      requestedCount: ids.length,
      returnedCount: results.length,
    }
  }

  /**
   * API Key가 문서에 접근 가능한지 확인
   */
  async canApiKeyAccessDocument(
    groupIds: string[],
    placements: Array<{ categoryId: number | null }>,
  ): Promise<boolean> {
    if (!groupIds || groupIds.length === 0) {
      return false
    }

    const categoryIds = placements
      .map((p) => p.categoryId)
      .filter((id): id is number => id !== null)

    if (categoryIds.length === 0) {
      return false
    }

    const accessibleFolderIds = await this.categoriesService.getAccessibleFolderIds(groupIds)
    return categoryIds.some((id) => accessibleFolderIds.includes(id))
  }
}
