import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common'
import { Observable, tap, catchError, throwError } from 'rxjs'

const SLOW_REQUEST_MS = 3000

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest()
    const { method, url } = req
    const start = Date.now()

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start
        const res = context.switchToHttp().getResponse()
        const status = res.statusCode
        const message = `${method} ${url} ${status} - ${ms}ms`

        if (ms > SLOW_REQUEST_MS) {
          this.logger.warn(`[SLOW] ${message}`)
        } else {
          this.logger.log(message)
        }
      }),
      catchError((err) => {
        // 에러 로그는 GlobalExceptionFilter에서 처리 — 여기선 응답시간만 기록
        const ms = Date.now() - start
        this.logger.warn(`${method} ${url} - ${ms}ms [error]`)
        return throwError(() => err)
      }),
    )
  }
}
