import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { createHmac } from 'crypto'
import type { WebhookEvent } from '@kms/shared'

interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

/** SSRF 방지를 위한 URL 검증 */
function validateWebhookUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new BadRequestException('유효하지 않은 URL 형식입니다')
  }

  // HTTPS만 허용 (개발 환경에서는 HTTP 허용)
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new BadRequestException('프로덕션 환경에서는 HTTPS URL만 허용됩니다')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('HTTP/HTTPS 프로토콜만 허용됩니다')
  }

  // 내부 IP 차단
  const hostname = parsed.hostname.toLowerCase()
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
    /\.local$/,
    /\.internal$/,
  ]

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new BadRequestException('내부 네트워크 주소는 허용되지 않습니다')
    }
  }
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('Webhooks')

  constructor(private readonly prisma: PrismaService) {}

  /** Webhook 목록 조회 */
  async findAll(page: number = 1, size: number = 20) {
    const [data, total] = await Promise.all([
      this.prisma.webhook.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.webhook.count(),
    ])

    return {
      data: data.map((w) => this.formatWebhook(w)),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  /** Webhook 상세 조회 */
  async findOne(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } })
    if (!webhook) throw new NotFoundException('Webhook을 찾을 수 없습니다')
    return this.formatWebhook(webhook)
  }

  /** Webhook 생성 */
  async create(data: { name: string; url: string; secret?: string; events: string[] }) {
    validateWebhookUrl(data.url)

    const webhook = await this.prisma.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        secret: data.secret,
        events: data.events,
      },
    })
    return this.formatWebhook(webhook)
  }

  /** Webhook 수정 */
  async update(id: string, data: { name?: string; url?: string; secret?: string; events?: string[]; isActive?: boolean }) {
    const existing = await this.prisma.webhook.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Webhook을 찾을 수 없습니다')

    if (data.url) {
      validateWebhookUrl(data.url)
    }

    const webhook = await this.prisma.webhook.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.url && { url: data.url }),
        ...(data.secret !== undefined && { secret: data.secret }),
        ...(data.events && { events: data.events }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
    return this.formatWebhook(webhook)
  }

  /** Webhook 삭제 */
  async remove(id: string) {
    const existing = await this.prisma.webhook.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Webhook을 찾을 수 없습니다')
    await this.prisma.webhook.delete({ where: { id } })
  }

  /** 특정 이벤트에 대한 웹훅 발송 */
  async dispatch(event: WebhookEvent, data: Record<string, unknown>) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: { has: event },
      },
    })

    if (webhooks.length === 0) return

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    }

    // 비동기로 전송 (에러가 발생해도 메인 플로우에 영향 없음)
    for (const webhook of webhooks) {
      this.sendWebhook(webhook, payload).catch((err: Error) => {
        this.logger.error(`Webhook 전송 실패 [${webhook.name}]: ${err.message}`)
      })
    }
  }

  /** 개별 웹훅 전송 (재시도 포함) */
  private async sendWebhook(
    webhook: { id: string; url: string; secret: string | null; name: string },
    payload: WebhookPayload,
    attempt: number = 1,
  ): Promise<void> {
    const MAX_RETRIES = 3
    const body = JSON.stringify(payload)
    const startTime = Date.now()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      'X-Webhook-Attempt': String(attempt),
    }

    // HMAC 서명 추가
    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret).update(body).digest('hex')
      headers['X-Webhook-Signature'] = `sha256=${signature}`
    }

    let statusCode: number | null = null
    let responseBody: string | null = null
    let success = false
    let errorMessage: string | null = null

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000), // 10초 타임아웃
      })

      statusCode = response.status
      responseBody = await response.text().catch(() => null)
      success = response.ok

      if (!success) {
        errorMessage = `HTTP ${statusCode}`
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err)
    }

    const duration = Date.now() - startTime

    // 전송 이력 저장
    await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload as object,
        statusCode,
        responseBody: responseBody?.slice(0, 1000), // 최대 1000자
        duration,
        success,
        errorMessage,
      },
    })

    // 재시도 로직 (5xx 에러 또는 네트워크 에러만)
    const shouldRetry = !success && attempt < MAX_RETRIES && (
      statusCode === null || // 네트워크 에러
      (statusCode >= 500 && statusCode < 600) // 서버 에러
    )

    if (shouldRetry) {
      const delay = Math.pow(2, attempt) * 1000 // exponential backoff: 2s, 4s, 8s
      this.logger.warn(`Webhook 재시도 예정 [${webhook.name}] 시도 ${attempt}/${MAX_RETRIES}, ${delay}ms 후`)
      await this.sleep(delay)
      return this.sendWebhook(webhook, payload, attempt + 1)
    }

    // Webhook 상태 업데이트
    await this.prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastCalledAt: new Date(),
        failCount: success ? 0 : { increment: 1 },
      },
    })

    if (success) {
      this.logger.log(`Webhook 전송 성공 [${webhook.name}] ${payload.event} - ${duration}ms (시도 ${attempt})`)
    } else {
      this.logger.warn(`Webhook 전송 최종 실패 [${webhook.name}] ${payload.event}: ${errorMessage} (시도 ${attempt})`)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** Webhook 전송 이력 조회 */
  async getDeliveries(webhookId: string, page: number = 1, size: number = 20) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } })
    if (!webhook) throw new NotFoundException('Webhook을 찾을 수 없습니다')

    const [data, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.webhookDelivery.count({ where: { webhookId } }),
    ])

    return {
      data: data.map((d) => ({
        id: d.id,
        webhookId: d.webhookId,
        event: d.event,
        payload: d.payload,
        statusCode: d.statusCode,
        success: d.success,
        errorMessage: d.errorMessage,
        duration: d.duration,
        createdAt: d.createdAt.toISOString(),
      })),
      meta: { total, page, size, totalPages: Math.ceil(total / size) },
    }
  }

  /** Webhook 테스트 전송 */
  async testWebhook(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } })
    if (!webhook) throw new NotFoundException('Webhook을 찾을 수 없습니다')

    const payload: WebhookPayload = {
      event: 'document.created' as WebhookEvent,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'Webhook 테스트 메시지입니다',
        documentId: '00000000-0000-0000-0000-000000000000',
      },
    }

    await this.sendWebhook(webhook, payload)
    return { message: '테스트 전송 완료' }
  }

  private formatWebhook(w: {
    id: string
    name: string
    url: string
    events: string[]
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    lastCalledAt: Date | null
    failCount: number
  }) {
    return {
      id: w.id,
      name: w.name,
      url: w.url,
      events: w.events,
      isActive: w.isActive,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
      lastCalledAt: w.lastCalledAt?.toISOString() ?? null,
      failCount: w.failCount,
    }
  }
}
