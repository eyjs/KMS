import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { ROLE_ACCESS_LEVELS, SECURITY_LEVEL_ORDER } from '@kms/shared'
import type { SecurityLevel, UserRole } from '@kms/shared'

/**
 * 문서 보안 등급 접근 제어 가드
 *
 * 사용법:
 * 1. 컨트롤러에서 request에 document.securityLevel이 설정된 경우 자동 체크
 * 2. 또는 서비스 레벨에서 canAccessDocument() 정적 메서드 사용
 *
 * 역할별 접근 범위:
 * - EXTERNAL: PUBLIC만
 * - EMPLOYEE: PUBLIC, INTERNAL
 * - TEAM_LEAD: PUBLIC, INTERNAL, CONFIDENTIAL
 * - EXECUTIVE: PUBLIC, INTERNAL, CONFIDENTIAL, SECRET
 * - ADMIN: 전체
 */
@Injectable()
export class SecurityLevelGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const documentSecurityLevel = request.documentSecurityLevel as SecurityLevel | undefined

    // 문서 보안 등급이 설정되지 않은 경우 통과
    if (!documentSecurityLevel) return true
    if (!user?.role) throw new ForbiddenException('인증이 필요합니다')

    if (!SecurityLevelGuard.canAccess(user.role, documentSecurityLevel)) {
      throw new ForbiddenException(
        `이 문서는 ${documentSecurityLevel} 등급입니다. 접근 권한이 없습니다.`,
      )
    }

    return true
  }

  /** 역할이 해당 보안 등급에 접근 가능한지 확인 */
  static canAccess(role: UserRole, securityLevel: SecurityLevel): boolean {
    const allowed = ROLE_ACCESS_LEVELS[role]
    if (!allowed) return false
    return allowed.includes(securityLevel)
  }

  /** 역할이 접근 가능한 최대 보안 등급 수준 반환 */
  static maxAccessLevel(role: UserRole): number {
    const allowed = ROLE_ACCESS_LEVELS[role]
    if (!allowed || allowed.length === 0) return -1
    return Math.max(...allowed.map((l) => SECURITY_LEVEL_ORDER[l]))
  }
}
