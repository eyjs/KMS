import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type {
  PermissionGroupEntity,
  UserGroupMembershipEntity,
  GroupFolderAccessEntity,
} from '@kms/shared'

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 권한 그룹 CRUD
  // ============================================================

  async findAll(): Promise<PermissionGroupEntity[]> {
    const groups = await this.prisma.permissionGroup.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            memberships: true,
            folderAccess: true,
          },
        },
      },
    })

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      isActive: g.isActive,
      memberCount: g._count.memberships,
      folderCount: g._count.folderAccess,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }))
  }

  async findOne(id: string): Promise<PermissionGroupEntity> {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            memberships: true,
            folderAccess: true,
          },
        },
      },
    })

    if (!group) {
      throw new NotFoundException('권한 그룹을 찾을 수 없습니다')
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      isActive: group.isActive,
      memberCount: group._count.memberships,
      folderCount: group._count.folderAccess,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    }
  }

  async create(data: { name: string; description?: string }): Promise<PermissionGroupEntity> {
    try {
      const group = await this.prisma.permissionGroup.create({
        data: {
          name: data.name,
          description: data.description ?? null,
        },
      })

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        isActive: group.isActive,
        memberCount: 0,
        folderCount: 0,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      }
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('같은 이름의 권한 그룹이 이미 존재합니다')
      }
      throw error
    }
  }

  async update(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean },
  ): Promise<PermissionGroupEntity> {
    const existing = await this.prisma.permissionGroup.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('권한 그룹을 찾을 수 없습니다')
    }

    try {
      const group = await this.prisma.permissionGroup.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          _count: {
            select: {
              memberships: true,
              folderAccess: true,
            },
          },
        },
      })

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        isActive: group.isActive,
        memberCount: group._count.memberships,
        folderCount: group._count.folderAccess,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      }
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('같은 이름의 권한 그룹이 이미 존재합니다')
      }
      throw error
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.permissionGroup.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('권한 그룹을 찾을 수 없습니다')
    }

    await this.prisma.permissionGroup.delete({ where: { id } })
  }

  // ============================================================
  // 그룹 멤버 관리
  // ============================================================

  async getMembers(groupId: string): Promise<UserGroupMembershipEntity[]> {
    const group = await this.prisma.permissionGroup.findUnique({ where: { id: groupId } })
    if (!group) {
      throw new NotFoundException('권한 그룹을 찾을 수 없습니다')
    }

    const memberships = await this.prisma.userGroupMembership.findMany({
      where: { groupId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      groupId: m.groupId,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    }))
  }

  async addMember(groupId: string, userId: string): Promise<UserGroupMembershipEntity> {
    const group = await this.prisma.permissionGroup.findUnique({ where: { id: groupId } })
    if (!group) {
      throw new NotFoundException('권한 그룹을 찾을 수 없습니다')
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다')
    }

    try {
      const membership = await this.prisma.userGroupMembership.create({
        data: { groupId, userId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      return {
        id: membership.id,
        userId: membership.userId,
        groupId: membership.groupId,
        joinedAt: membership.joinedAt.toISOString(),
        user: membership.user,
      }
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('이미 그룹에 속한 사용자입니다')
      }
      throw error
    }
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    const membership = await this.prisma.userGroupMembership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    })

    if (!membership) {
      throw new NotFoundException('해당 사용자가 그룹에 속해있지 않습니다')
    }

    await this.prisma.userGroupMembership.delete({
      where: { id: membership.id },
    })
  }

  // ============================================================
  // 그룹-폴더 권한 관리
  // ============================================================

  async getFolderAccess(groupId: string): Promise<GroupFolderAccessEntity[]> {
    const group = await this.prisma.permissionGroup.findUnique({ where: { id: groupId } })
    if (!group) {
      throw new NotFoundException('권한 그룹을 찾을 수 없습니다')
    }

    const accesses = await this.prisma.groupFolderAccess.findMany({
      where: { groupId },
      include: {
        category: {
          select: { id: true, code: true, name: true, domainCode: true },
        },
      },
      orderBy: { grantedAt: 'asc' },
    })

    return accesses.map((a) => ({
      id: a.id,
      groupId: a.groupId,
      categoryId: a.categoryId,
      accessType: a.accessType as 'READ' | 'WRITE',
      includeChildren: a.includeChildren,
      grantedAt: a.grantedAt.toISOString(),
      folderName: a.category.name,
      folderCode: a.category.code,
      domainCode: a.category.domainCode,
    }))
  }

  async setFolderAccess(
    groupId: string,
    data: { categoryId: number; accessType: 'READ' | 'WRITE'; includeChildren?: boolean },
  ): Promise<GroupFolderAccessEntity> {
    const group = await this.prisma.permissionGroup.findUnique({ where: { id: groupId } })
    if (!group) {
      throw new NotFoundException('권한 그룹을 찾을 수 없습니다')
    }

    const category = await this.prisma.domainCategory.findUnique({
      where: { id: data.categoryId },
    })
    if (!category) {
      throw new NotFoundException('폴더를 찾을 수 없습니다')
    }

    // upsert: 이미 존재하면 업데이트, 없으면 생성
    const access = await this.prisma.groupFolderAccess.upsert({
      where: { groupId_categoryId: { groupId, categoryId: data.categoryId } },
      create: {
        groupId,
        categoryId: data.categoryId,
        accessType: data.accessType,
        includeChildren: data.includeChildren ?? true,
      },
      update: {
        accessType: data.accessType,
        includeChildren: data.includeChildren ?? true,
      },
      include: {
        category: {
          select: { id: true, code: true, name: true, domainCode: true },
        },
      },
    })

    return {
      id: access.id,
      groupId: access.groupId,
      categoryId: access.categoryId,
      accessType: access.accessType as 'READ' | 'WRITE',
      includeChildren: access.includeChildren,
      grantedAt: access.grantedAt.toISOString(),
      folderName: access.category.name,
      folderCode: access.category.code,
      domainCode: access.category.domainCode,
    }
  }

  async removeFolderAccess(groupId: string, categoryId: number): Promise<void> {
    const access = await this.prisma.groupFolderAccess.findUnique({
      where: { groupId_categoryId: { groupId, categoryId } },
    })

    if (!access) {
      throw new NotFoundException('해당 폴더에 대한 권한이 없습니다')
    }

    await this.prisma.groupFolderAccess.delete({
      where: { id: access.id },
    })
  }

  // ============================================================
  // 사용자 그룹 관리
  // ============================================================

  async getUserGroups(userId: string): Promise<PermissionGroupEntity[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다')
    }

    const memberships = await this.prisma.userGroupMembership.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: {
              select: {
                memberships: true,
                folderAccess: true,
              },
            },
          },
        },
      },
    })

    return memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      isActive: m.group.isActive,
      memberCount: m.group._count.memberships,
      folderCount: m.group._count.folderAccess,
      createdAt: m.group.createdAt.toISOString(),
      updatedAt: m.group.updatedAt.toISOString(),
    }))
  }

  async updateUserGroups(userId: string, groupIds: string[]): Promise<PermissionGroupEntity[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다')
    }

    // 존재하지 않는 그룹 ID가 있는지 확인
    if (groupIds.length > 0) {
      const existingGroups = await this.prisma.permissionGroup.findMany({
        where: { id: { in: groupIds } },
        select: { id: true },
      })
      const existingIds = new Set(existingGroups.map((g) => g.id))
      const invalidIds = groupIds.filter((id) => !existingIds.has(id))
      if (invalidIds.length > 0) {
        throw new BadRequestException(`존재하지 않는 그룹 ID: ${invalidIds.join(', ')}`)
      }
    }

    // 트랜잭션: 기존 멤버십 삭제 후 새로 생성
    await this.prisma.$transaction(async (tx) => {
      await tx.userGroupMembership.deleteMany({ where: { userId } })

      if (groupIds.length > 0) {
        await tx.userGroupMembership.createMany({
          data: groupIds.map((groupId) => ({ userId, groupId })),
        })
      }
    })

    return this.getUserGroups(userId)
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    )
  }
}
