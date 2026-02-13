import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let body: Record<string, unknown> = {
      statusCode: status,
      message: '서버 내부 오류가 발생했습니다',
      timestamp: new Date().toISOString(),
      path: request.url,
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()

      if (typeof res === 'string') {
        body = { ...body, statusCode: status, message: res }
      } else if (typeof res === 'object') {
        // ConflictException 등에서 전달한 메타데이터 보존, NestJS 기본 error 필드 제외
        const { error: _error, ...rest } = res as Record<string, unknown>
        body = { ...body, statusCode: status, ...rest }
      }

      // message가 배열일 수 있음 (ValidationPipe → class-validator)
      const logMessage = Array.isArray(body.message)
        ? body.message.join('; ')
        : body.message

      // 4xx는 warn, 5xx는 error
      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} ${status} - ${logMessage}`,
          exception.stack,
        )
      } else {
        this.logger.warn(`${request.method} ${request.url} ${status} - ${logMessage}`)
      }
    } else {
      // 예상치 못한 에러
      const err = exception instanceof Error ? exception : new Error(String(exception))
      this.logger.error(
        `${request.method} ${request.url} 500 - Unhandled: ${err.message}`,
        err.stack,
      )
    }

    response.status(status).json(body)
  }
}
