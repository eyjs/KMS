import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLE_ORDER } from '@kms/shared'
import { ROLES_KEY } from '../decorators/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const { user } = context.switchToHttp().getRequest()
    if (!user?.role) {
      throw new ForbiddenException('권한이 없습니다')
    }

    const userLevel = ROLE_ORDER[user.role as keyof typeof ROLE_ORDER] ?? 0
    const requiredLevel = Math.min(
      ...requiredRoles.map((r) => ROLE_ORDER[r as keyof typeof ROLE_ORDER] ?? 999),
    )

    if (userLevel < requiredLevel) {
      throw new ForbiddenException('권한이 부족합니다')
    }

    return true
  }
}
