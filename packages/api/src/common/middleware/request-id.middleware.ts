import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

export const REQUEST_ID_HEADER = 'x-request-id'

/** Request에 requestId 필드 추가 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

/**
 * 요청 ID 미들웨어
 * - 클라이언트가 X-Request-ID를 전달하면 그대로 사용
 * - 없으면 UUID 생성
 * - 응답 헤더에도 동일한 ID 포함
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const existingId = req.headers[REQUEST_ID_HEADER] as string | undefined
    const requestId = existingId || randomUUID()

    req.requestId = requestId
    res.setHeader(REQUEST_ID_HEADER, requestId)

    next()
  }
}
