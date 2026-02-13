import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TaxonomyService } from '../taxonomy/taxonomy.service'
import type { DomainCategoryEntity, FolderAccessLevel, FolderPermission, UserRole } from '@kms/shared'
import { ROLE_ORDER, FOLDER_PERMISSION_ORDER } from '@kms/shared'

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomyService: TaxonomyService,
  ) {}

  // ============================================================
  // 폴더 코드 자동 생성
  // ============================================================

  /**
   * 폴더 코드 자동 생성
   * 루트 폴더: {도메인코드}-F01, {도메인코드}-F02...
   * 하위 폴더: {부모코드}-01, {부모코드}-02...
   *
   * 참고: 동시성 문제는 create() 메서드에서 재시도 로직으로 처리
   */
  async generateFolderCode(domainCode: string, parentId: number | null): Promise<string> {
    if (!parentId) {
      // 루트 폴더: {도메인코드}-F01
      const prefix = `${domainCode}-F`
      const last = await this.prisma.domainCategory.findFirst({
        where: { domainCode, parentId: null, code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        select: { code: true },
      })
      const parsedSeq = last?.code ? parseInt(last.code.slice(prefix.length), 10) : 0
      const seq = Number.isNaN(parsedSeq) ? 1 : parsedSeq + 1
      return `${prefix}${String(seq).padStart(2, '0')}`
    }

    // 하위 폴더: {부모코드}-01
    const parent = await this.prisma.domainCategory.findUnique({
      where: { id: parentId },
      select: { code: true },
    })
    if (!parent) throw new BadRequestException('부모 폴더를 찾을 수 없습니다')

    const prefix = `${parent.code}-`
    const last = await this.prisma.domainCategory.findFirst({
      where: { parentId, code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    const parsedSeq = last?.code ? parseInt(last.code.slice(prefix.length), 10) : 0
    const seq = Number.isNaN(parsedSeq) ? 1 : parsedSeq + 1
    return `${prefix}${String(seq).padStart(2, '0')}`
  }

  async findByDomain(domainCode: string): Promise<DomainCategoryEntity[]> {
    await this.validateDomain(domainCode)

    // 하위 도메인이 있으면 전체(자기+하위) 폴더를 조회
    const descendantCodes = await this.taxonomyService.getDescendantCodes(domainCode)

    const all = await this.prisma.domainCategory.findMany({
      where: { domainCode: { in: descendantCodes } },
      orderBy: { sortOrder: 'asc' },
    })

    return this.buildTree(all)
  }

  async create(domainCode: string, data: { parentId?: number; name: string; sortOrder?: number }) {
    await this.validateDomain(domainCode)

    if (data.parentId) {
      const parent = await this.prisma.domainCategory.findUnique({
        where: { id: data.parentId },
      })
      if (!parent || parent.domainCode !== domainCode) {
        throw new BadRequestException('부모 폴더가 해당 도메인에 존재하지 않습니다')
      }
    }

    // 동시성 문제 해결을 위해 재시도 로직 적용 (최대 3회)
    const MAX_RETRIES = 3
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const code = await this.generateFolderCode(domainCode, data.parentId ?? null)

      try {
        return await this.prisma.domainCategory.create({
          data: {
            code,
            domainCode,
            parentId: data.parentId ?? null,
            name: data.name,
            sortOrder: data.sortOrder ?? 0,
            accessLevel: 'INHERIT',
            allowedRoles: [],
            allowedUserIds: [],
          },
        })
      } catch (error: unknown) {
        if (this.isUniqueViolation(error)) {
          // 코드 중복: 이름 중복인지 코드 중복인지 확인
          const existing = await this.prisma.domainCategory.findFirst({
            where: { domainCode, parentId: data.parentId ?? null, name: data.name },
          })
          if (existing) {
            throw new ConflictException('같은 위치에 같은 이름의 폴더가 이미 존재합니다')
          }
          // 코드 중복이면 재시도
          if (attempt === MAX_RETRIES) {
            throw new ConflictException('폴더 코드 생성 실패. 잠시 후 다시 시도해주세요.')
          }
          continue
        }
        throw error
      }
    }

    throw new ConflictException('폴더 생성 실패')
  }

  async update(id: number, data: { name?: string; parentId?: number | null; sortOrder?: number }) {
    const category = await this.prisma.domainCategory.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('폴더를 찾을 수 없습니다')

    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id) {
        throw new BadRequestException('자기 자신을 부모로 설정할 수 없습니다')
      }
      const parent = await this.prisma.domainCategory.findUnique({
        where: { id: data.parentId },
      })
      if (!parent || parent.domainCode !== category.domainCode) {
        throw new BadRequestException('부모 폴더가 해당 도메인에 존재하지 않습니다')
      }
      // 자기 하위를 부모로 설정하는 것 방지
      const descendants = await this.getDescendantIds(id)
      if (descendants.includes(data.parentId)) {
        throw new BadRequestException('하위 폴더를 부모로 설정할 수 없습니다')
      }
    }

    try {
      return await this.prisma.domainCategory.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.parentId !== undefined && { parentId: data.parentId }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      })
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('같은 위치에 같은 이름의 폴더가 이미 존재합니다')
      }
      throw error
    }
  }

  async remove(id: number) {
    const category = await this.prisma.domainCategory.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('폴더를 찾을 수 없습니다')

    // CASCADE로 하위 폴더도 삭제, 배치는 SET NULL
    await this.prisma.domainCategory.delete({ where: { id } })
    return { message: '폴더가 삭제되었습니다' }
  }

  // ============================================================
  // 폴더 권한 관리
  // ============================================================

  async updatePermissions(
    id: number,
    data: {
      accessLevel: FolderAccessLevel
      allowedRoles?: string[] | null
      allowedUserIds?: string[] | null
    },
  ) {
    const category = await this.prisma.domainCategory.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('폴더를 찾을 수 없습니다')

    return this.prisma.domainCategory.update({
      where: { id },
      data: {
        accessLevel: data.accessLevel,
        allowedRoles: data.allowedRoles ?? [],
        allowedUserIds: data.allowedUserIds ?? [],
      },
    })
  }

  /**
   * 사용자가 폴더에 접근 가능한지 확인
   * INHERIT: 부모 폴더 재귀 확인, 루트면 true
   * PUBLIC: 항상 true
   * RESTRICTED: allowedUserIds 또는 allowedRoles 체크
   * 그룹 권한도 함께 확인 (Permissive 모드: 어느 하나라도 권한 있으면 허용)
   */
  async canAccessFolder(userId: string, userRole: UserRole, categoryId: number): Promise<boolean> {
    const permission = await this.getFolderPermission(userId, userRole, categoryId)
    return permission !== 'NONE'
  }

  /**
   * 사용자가 폴더에 쓰기 권한이 있는지 확인
   */
  async canWriteFolder(userId: string, userRole: UserRole, categoryId: number): Promise<boolean> {
    const permission = await this.getFolderPermission(userId, userRole, categoryId)
    return permission === 'WRITE'
  }

  /**
   * 사용자의 폴더 권한 수준을 반환
   * 1. ADMIN은 항상 WRITE
   * 2. 그룹 권한 확인 → READ/WRITE/NONE
   * 3. 기존 allowedRoles/allowedUserIds (하위 호환)
   * 4. accessLevel (INHERIT/PUBLIC/RESTRICTED)
   *
   * Permissive 모드: 가장 높은 권한 적용
   */
  async getFolderPermission(userId: string, userRole: UserRole, categoryId: number): Promise<FolderPermission> {
    // 1. ADMIN은 항상 WRITE
    if (userRole === 'ADMIN') {
      return 'WRITE'
    }

    const folder = await this.prisma.domainCategory.findUnique({ where: { id: categoryId } })
    if (!folder) return 'NONE'

    let maxPermission: FolderPermission = 'NONE'

    // 2. 그룹 권한 확인 (가장 높은 권한 적용)
    const groupPermission = await this.getGroupPermission(userId, categoryId)
    if (FOLDER_PERMISSION_ORDER[groupPermission] > FOLDER_PERMISSION_ORDER[maxPermission]) {
      maxPermission = groupPermission
    }

    // 3. 기존 allowedUserIds/allowedRoles (RESTRICTED 모드일 때만 적용)
    if (folder.accessLevel === 'RESTRICTED') {
      if (folder.allowedUserIds.includes(userId)) {
        // 기존 방식으로 허용된 경우 WRITE로 간주
        if (FOLDER_PERMISSION_ORDER['WRITE'] > FOLDER_PERMISSION_ORDER[maxPermission]) {
          maxPermission = 'WRITE'
        }
      }

      const userRoleLevel = ROLE_ORDER[userRole] ?? 0
      for (const allowedRole of folder.allowedRoles) {
        const allowedRoleLevel = ROLE_ORDER[allowedRole as UserRole] ?? 0
        if (userRoleLevel >= allowedRoleLevel) {
          if (FOLDER_PERMISSION_ORDER['WRITE'] > FOLDER_PERMISSION_ORDER[maxPermission]) {
            maxPermission = 'WRITE'
          }
          break
        }
      }
    }

    // 4. accessLevel 확인
    if (folder.accessLevel === 'PUBLIC') {
      // PUBLIC은 전체 공개 (최소 READ)
      if (FOLDER_PERMISSION_ORDER['READ'] > FOLDER_PERMISSION_ORDER[maxPermission]) {
        maxPermission = 'READ'
      }
    } else if (folder.accessLevel === 'INHERIT') {
      // INHERIT: 부모 폴더 권한 확인
      if (folder.parentId) {
        const parentPermission = await this.getFolderPermission(userId, userRole, folder.parentId)
        if (FOLDER_PERMISSION_ORDER[parentPermission] > FOLDER_PERMISSION_ORDER[maxPermission]) {
          maxPermission = parentPermission
        }
      } else {
        // 루트 폴더이고 INHERIT면 기본 READ 허용
        if (FOLDER_PERMISSION_ORDER['READ'] > FOLDER_PERMISSION_ORDER[maxPermission]) {
          maxPermission = 'READ'
        }
      }
    }

    return maxPermission
  }

  /**
   * 사용자가 속한 그룹을 통해 폴더에 대한 권한을 확인
   * includeChildren이 true인 경우 상위 폴더 권한도 확인
   */
  async getGroupPermission(userId: string, categoryId: number): Promise<FolderPermission> {
    // 사용자가 속한 활성 그룹 목록
    const memberships = await this.prisma.userGroupMembership.findMany({
      where: { userId },
      include: {
        group: {
          select: { id: true, isActive: true },
        },
      },
    })

    const activeGroupIds = memberships
      .filter((m) => m.group.isActive)
      .map((m) => m.groupId)

    if (activeGroupIds.length === 0) {
      return 'NONE'
    }

    // 폴더와 상위 폴더 목록 수집 (includeChildren을 위해)
    const folderIds = await this.getFolderAncestorIds(categoryId)

    // 그룹의 폴더 권한 조회
    const accesses = await this.prisma.groupFolderAccess.findMany({
      where: {
        groupId: { in: activeGroupIds },
        OR: [
          // 정확히 해당 폴더에 대한 권한
          { categoryId },
          // 상위 폴더에 대한 권한 (includeChildren이 true인 경우)
          {
            categoryId: { in: folderIds },
            includeChildren: true,
          },
        ],
      },
    })

    // 가장 높은 권한 반환
    let maxPermission: FolderPermission = 'NONE'
    for (const access of accesses) {
      const perm = access.accessType as FolderPermission
      if (FOLDER_PERMISSION_ORDER[perm] > FOLDER_PERMISSION_ORDER[maxPermission]) {
        maxPermission = perm
      }
    }

    return maxPermission
  }

  /**
   * 폴더의 상위 폴더 ID 목록 반환 (자기 자신 제외)
   */
  private async getFolderAncestorIds(categoryId: number): Promise<number[]> {
    const ancestors: number[] = []
    let currentId: number | null = categoryId

    while (currentId) {
      const found: { parentId: number | null } | null = await this.prisma.domainCategory.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      })
      if (!found || !found.parentId) break
      ancestors.push(found.parentId)
      currentId = found.parentId
    }

    return ancestors
  }

  /**
   * 폴더의 전체 경로를 코드 기반으로 반환
   * 예: "GA-F01/GA-F01-01" → "GA-F01-01"만 반환 (코드 자체가 경로 포함)
   */
  async getFolderCodePath(categoryId: number): Promise<string> {
    const folder = await this.prisma.domainCategory.findUnique({
      where: { id: categoryId },
      select: { code: true },
    })
    return folder?.code ?? ''
  }

  async move(id: number, parentId: number | null) {
    return this.update(id, { parentId })
  }

  // ============================================================
  // API Key 폴더 권한 (그룹 기반)
  // ============================================================

  /**
   * 그룹들이 접근 가능한 모든 폴더 ID 목록 반환
   * includeChildren이 true인 경우 하위 폴더도 포함
   */
  async getAccessibleFolderIds(groupIds: string[]): Promise<number[]> {
    if (!groupIds || groupIds.length === 0) {
      return []
    }

    // 그룹에 직접 할당된 폴더 권한 조회
    const accesses = await this.prisma.groupFolderAccess.findMany({
      where: {
        groupId: { in: groupIds },
        group: { isActive: true },
      },
      select: { categoryId: true, includeChildren: true },
    })

    const directFolderIds = new Set<number>()
    const foldersWithChildren: number[] = []

    for (const access of accesses) {
      directFolderIds.add(access.categoryId)
      if (access.includeChildren) {
        foldersWithChildren.push(access.categoryId)
      }
    }

    // includeChildren이 true인 폴더의 하위 폴더 모두 수집
    const allFolderIds = new Set<number>(directFolderIds)
    for (const folderId of foldersWithChildren) {
      const descendants = await this.getDescendantIds(folderId)
      for (const id of descendants) {
        allFolderIds.add(id)
      }
    }

    return Array.from(allFolderIds)
  }

  /**
   * API Key 그룹 기반 폴더 권한 확인
   * 지정된 그룹들이 해당 폴더에 접근 가능한지 확인
   */
  async getGroupsPermissionForFolder(groupIds: string[], categoryId: number): Promise<FolderPermission> {
    if (!groupIds || groupIds.length === 0) {
      return 'NONE'
    }

    // 폴더와 상위 폴더 목록 수집 (includeChildren을 위해)
    const folderIds = await this.getFolderAncestorIds(categoryId)

    // 그룹의 폴더 권한 조회
    const accesses = await this.prisma.groupFolderAccess.findMany({
      where: {
        groupId: { in: groupIds },
        group: { isActive: true },
        OR: [
          { categoryId },
          {
            categoryId: { in: folderIds },
            includeChildren: true,
          },
        ],
      },
    })

    // 가장 높은 권한 반환
    let maxPermission: FolderPermission = 'NONE'
    for (const access of accesses) {
      const perm = access.accessType as FolderPermission
      if (FOLDER_PERMISSION_ORDER[perm] > FOLDER_PERMISSION_ORDER[maxPermission]) {
        maxPermission = perm
      }
    }

    return maxPermission
  }

  private async getDescendantIds(id: number): Promise<number[]> {
    const children = await this.prisma.domainCategory.findMany({
      where: { parentId: id },
      select: { id: true },
    })
    const result: number[] = children.map((c) => c.id)
    for (const child of children) {
      const grandChildren = await this.getDescendantIds(child.id)
      result.push(...grandChildren)
    }
    return result
  }

  private buildTree(categories: Array<{
    id: number
    code: string
    domainCode: string
    parentId: number | null
    name: string
    sortOrder: number
    accessLevel: string
    allowedRoles: string[]
    allowedUserIds: string[]
    createdAt: Date
  }>): DomainCategoryEntity[] {
    const map = new Map<number, DomainCategoryEntity>()
    for (const c of categories) {
      map.set(c.id, {
        id: c.id,
        code: c.code,
        domainCode: c.domainCode,
        parentId: c.parentId,
        name: c.name,
        sortOrder: c.sortOrder,
        accessLevel: c.accessLevel as FolderAccessLevel,
        allowedRoles: c.allowedRoles.length > 0 ? c.allowedRoles : null,
        allowedUserIds: c.allowedUserIds.length > 0 ? c.allowedUserIds : null,
        children: [],
        createdAt: c.createdAt.toISOString(),
      })
    }
    const roots: DomainCategoryEntity[] = []
    for (const c of map.values()) {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children!.push(c)
      } else {
        roots.push(c)
      }
    }
    return roots
  }

  private async validateDomain(code: string) {
    const domain = await this.prisma.domainMaster.findUnique({ where: { code } })
    if (!domain || !domain.isActive) {
      throw new BadRequestException(`유효하지 않은 도메인입니다: ${code}`)
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    )
  }
}
