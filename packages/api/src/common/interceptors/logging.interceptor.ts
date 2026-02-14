import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common'
import { Observable, tap, catchError, throwError } from 'rxjs'
import { Request } from 'express'

const SLOW_REQUEST_MS = 3000

interface RequestLog {
  requestId?: string
  method: string
  url: string
  userId?: string
  userRole?: string
  isApiKey?: boolean
  status?: number
  duration?: number
  error?: string
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>()
    const { method, url, requestId } = req
    const start = Date.now()

    // 사용자 정보 추출 (인증 후 req.user에 설정됨)
    const user = (req as Request & { user?: { sub?: string; role?: string; isApiKey?: boolean } }).user

    const baseLog: RequestLog = {
      requestId,
      method,
      url,
      userId: user?.sub,
      userRole: user?.role,
      isApiKey: user?.isApiKey,
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start
        const res = context.switchToHttp().getResponse()
        const status = res.statusCode

        const log: RequestLog = { ...baseLog, status, duration }
        const message = this.formatLogMessage(log)

        if (duration > SLOW_REQUEST_MS) {
          this.logger.warn(`[SLOW] ${message}`)
        } else {
          this.logger.log(message)
        }
      }),
      catchError((err) => {
        const duration = Date.now() - start
        const log: RequestLog = { ...baseLog, duration, error: err.message }
        const message = this.formatLogMessage(log)

        this.logger.warn(message)
        return throwError(() => err)
      }),
    )
  }

  private formatLogMessage(log: RequestLog): string {
    const parts = [
      log.requestId ? `[${log.requestId.slice(0, 8)}]` : '',
      log.method,
      log.url,
      log.status !== undefined ? String(log.status) : '',
      `${log.duration}ms`,
    ]

    // 사용자 정보 추가
    if (log.userId) {
      const userInfo = log.isApiKey ? `apikey:${log.userId.slice(0, 8)}` : `user:${log.userId.slice(0, 8)}`
      parts.push(`(${userInfo})`)
    }

    // 에러 메시지 추가
    if (log.error) {
      parts.push(`[error: ${log.error}]`)
    }

    return parts.filter(Boolean).join(' ')
  }
}
