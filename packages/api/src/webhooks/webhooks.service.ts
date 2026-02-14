import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { createHmac } from 'crypto'
import type { WebhookEvent } from '@kms/shared'

interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
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
      this.sendWebhook(webhook, payload).catch((err) => {
        this.logger.error(`Webhook 전송 실패 [${webhook.name}]: ${err.message}`)
      })
    }
  }

  /** 개별 웹훅 전송 */
  private async sendWebhook(
    webhook: { id: string; url: string; secret: string | null; name: string },
    payload: WebhookPayload,
  ) {
    const body = JSON.stringify(payload)
    const startTime = Date.now()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
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

    // Webhook 상태 업데이트
    await this.prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastCalledAt: new Date(),
        failCount: success ? 0 : { increment: 1 },
      },
    })

    if (success) {
      this.logger.log(`Webhook 전송 성공 [${webhook.name}] ${payload.event} - ${duration}ms`)
    } else {
      this.logger.warn(`Webhook 전송 실패 [${webhook.name}] ${payload.event}: ${errorMessage}`)
    }
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
