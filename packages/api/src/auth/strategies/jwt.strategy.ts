import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../prisma/prisma.service'

interface JwtPayload {
  sub: string
  email: string
  role: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET')
    if (!secret) {
      throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다')
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        isActive: true,
        role: true,
        groupMemberships: {
          where: { group: { isActive: true } },
          select: { groupId: true },
        },
      },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다')
    }

    // DB의 최신 역할을 사용 (토큰 발급 이후 역할 변경 반영)
    // 내부 사용자는 isApiKey: false, groupIds는 WRITE 권한 체크용으로 포함
    return {
      sub: payload.sub,
      email: payload.email,
      role: user.role,
      isApiKey: false,
      groupIds: user.groupMemberships.map((m) => m.groupId),
    }
  }
}
