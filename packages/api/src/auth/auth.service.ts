import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import type { UserRole, PermissionGroupEntity } from '@kms/shared'

interface JwtPayload {
  sub: string
  email: string
  role: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      throw new UnauthorizedException('잘못된 이메일 또는 비밀번호입니다')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('잘못된 이메일 또는 비밀번호입니다')
    }

    return this.generateTokens(user)
  }

  private getRefreshSecret(): string {
    return this.config.get('JWT_REFRESH_SECRET') ?? this.config.get('JWT_SECRET') + '-refresh'
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      })

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      })
      if (!user || !user.isActive) {
        throw new UnauthorizedException('유효하지 않은 토큰입니다')
      }

      return this.generateTokens(user)
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다')
    }
  }

  async createUser(email: string, password: string, name: string, role: UserRole) {
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name, role },
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }
  }

  async findAllUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return users
  }

  async updateUserRole(userId: string, role: UserRole, currentUserId: string) {
    if (userId === currentUserId) {
      throw new BadRequestException('자기 자신의 역할은 변경할 수 없습니다')
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
  }

  async toggleUserActive(userId: string, currentUserId: string) {
    if (userId === currentUserId) {
      throw new BadRequestException('자기 자신의 계정은 비활성화할 수 없습니다')
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
  }

  async createApiKey(name: string, role: UserRole, expiresAt?: Date, groupIds?: string[]) {
    const rawKey = `kms_${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.substring(0, 8)

    // 그룹 ID 검증
    if (groupIds && groupIds.length > 0) {
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

    const apiKey = await this.prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        name,
        role,
        expiresAt: expiresAt ?? null,
        ...(groupIds && groupIds.length > 0 && {
          groupMemberships: {
            create: groupIds.map((groupId) => ({ groupId })),
          },
        }),
      },
      include: {
        groupMemberships: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
    })

    // rawKey는 이 시점에서만 반환 (이후 복구 불가)
    return {
      key: rawKey,
      keyPrefix,
      name,
      role,
      groupIds: apiKey.groupMemberships.map((m) => m.groupId),
      groups: apiKey.groupMemberships.map((m) => ({ id: m.group.id, name: m.group.name })),
    }
  }

  async validateApiKey(rawKey: string) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        groupMemberships: {
          include: { group: { select: { id: true, isActive: true } } },
        },
      },
    })

    if (!apiKey || !apiKey.isActive) return null
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null

    // 마지막 사용 시각 업데이트
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })

    // 활성 그룹만 필터링
    const groupIds = apiKey.groupMemberships
      .filter((m) => m.group.isActive)
      .map((m) => m.groupId)

    return {
      id: apiKey.id,
      role: apiKey.role,
      name: apiKey.name,
      groupIds,
      isApiKey: true,
    }
  }

  private generateTokens(user: { id: string; email: string; name: string; role: string }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role }

    const accessToken = this.jwt.sign(payload)
    const refreshToken = this.jwt.sign(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    })

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  }

  // ============================================================
  // API Key 관리
  // ============================================================

  async findAllApiKeys() {
    const apiKeys = await this.prisma.apiKey.findMany({
      include: {
        groupMemberships: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return apiKeys.map((k) => ({
      id: String(k.id),
      name: k.name,
      keyPrefix: k.keyPrefix,
      role: k.role,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      isActive: k.isActive,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      groupIds: k.groupMemberships.map((m) => m.groupId),
      groups: k.groupMemberships.map((m) => ({ id: m.group.id, name: m.group.name })),
    }))
  }

  async toggleApiKeyActive(apiKeyId: number) {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } })
    if (!apiKey) {
      throw new NotFoundException('API Key를 찾을 수 없습니다')
    }
    return this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: !apiKey.isActive },
    })
  }

  async deleteApiKey(apiKeyId: number) {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } })
    if (!apiKey) {
      throw new NotFoundException('API Key를 찾을 수 없습니다')
    }
    await this.prisma.apiKey.delete({ where: { id: apiKeyId } })
    return { message: 'API Key가 삭제되었습니다' }
  }

  async getApiKeyGroups(apiKeyId: number): Promise<PermissionGroupEntity[]> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } })
    if (!apiKey) {
      throw new NotFoundException('API Key를 찾을 수 없습니다')
    }

    const memberships = await this.prisma.apiKeyGroupMembership.findMany({
      where: { apiKeyId },
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

  async updateApiKeyGroups(apiKeyId: number, groupIds: string[]): Promise<PermissionGroupEntity[]> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId } })
    if (!apiKey) {
      throw new NotFoundException('API Key를 찾을 수 없습니다')
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
      await tx.apiKeyGroupMembership.deleteMany({ where: { apiKeyId } })

      if (groupIds.length > 0) {
        await tx.apiKeyGroupMembership.createMany({
          data: groupIds.map((groupId) => ({ apiKeyId, groupId })),
        })
      }
    })

    return this.getApiKeyGroups(apiKeyId)
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
}
