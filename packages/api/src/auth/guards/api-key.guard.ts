import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from '../auth.service'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const apiKey = request.headers['x-api-key'] as string

    if (!apiKey) {
      throw new UnauthorizedException('API Key가 필요합니다')
    }

    const result = await this.authService.validateApiKey(apiKey)
    if (!result) {
      throw new UnauthorizedException('유효하지 않은 API Key입니다')
    }

    // API Key 사용자 정보를 request에 주입 (groupIds 포함)
    request.user = {
      sub: String(result.id),
      role: result.role,
      name: result.name,
      isApiKey: true,
      groupIds: result.groupIds,
    }
    return true
  }
}
