import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import type { UserRole } from '@kms/shared'

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

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_SECRET') + '-refresh',
      })

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      })
      if (!user || !user.isActive) {
        throw new UnauthorizedException('유효하지 않은 토큰입니다')
      }

      return this.generateTokens(user)
    } catch {
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

  async updateUserRole(userId: string, role: UserRole) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
  }

  async toggleUserActive(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
  }

  async createApiKey(name: string, role: UserRole, expiresAt?: Date) {
    const rawKey = `kms_${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.substring(0, 8)

    await this.prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        name,
        role,
        expiresAt: expiresAt ?? null,
      },
    })

    // rawKey는 이 시점에서만 반환 (이후 복구 불가)
    return { key: rawKey, keyPrefix, name, role }
  }

  async validateApiKey(rawKey: string) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash } })

    if (!apiKey || !apiKey.isActive) return null
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null

    // 마지막 사용 시각 업데이트
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })

    return { role: apiKey.role, name: apiKey.name }
  }

  private generateTokens(user: { id: string; email: string; name: string; role: string }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role }

    const accessToken = this.jwt.sign(payload)
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET') + '-refresh',
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    })

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  }
}
