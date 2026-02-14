import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from '../auth.service'

/**
 * JWT 또는 API Key 둘 중 하나로 인증
 * - Authorization: Bearer {jwt} 헤더가 있으면 JWT 검증
 * - X-API-Key 헤더가 있으면 API Key 검증
 * - 둘 다 없으면 401 Unauthorized
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization as string | undefined
    const apiKey = request.headers['x-api-key'] as string | undefined

    // JWT 토큰 우선
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get('JWT_SECRET'),
        })
        request.user = payload
        return true
      } catch {
        throw new UnauthorizedException('유효하지 않은 토큰입니다')
      }
    }

    // API Key 검증
    if (apiKey) {
      const result = await this.authService.validateApiKey(apiKey)
      if (!result) {
        throw new UnauthorizedException('유효하지 않은 API Key입니다')
      }

      request.user = {
        sub: String(result.id),
        role: result.role,
        name: result.name,
        isApiKey: true,
        groupIds: result.groupIds,
      }
      return true
    }

    throw new UnauthorizedException('인증이 필요합니다 (JWT 또는 API Key)')
  }
}
