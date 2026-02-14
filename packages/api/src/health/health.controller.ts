import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { PrismaService } from '../prisma/prisma.service'
import { HealthResponse } from '../common/dto/api-response.dto'

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '시스템 헬스체크', description: 'DB 연결 상태 및 서버 가동 시간을 반환합니다.' })
  @ApiResponse({ status: 200, description: '시스템 정상', type: HealthResponse })
  async check() {
    const startTime = Date.now()

    // DB 연결 체크
    let dbStatus = 'ok'
    let dbLatency = 0
    try {
      const dbStart = Date.now()
      await this.prisma.$queryRaw`SELECT 1`
      dbLatency = Date.now() - dbStart
    } catch {
      dbStatus = 'error'
    }

    return {
      status: dbStatus === 'ok' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
        },
      },
      responseTimeMs: Date.now() - startTime,
    }
  }

  @Get('live')
  @ApiOperation({ summary: '라이브니스 체크 (컨테이너 생존)' })
  live() {
    return { status: 'ok' }
  }

  @Get('ready')
  @ApiOperation({ summary: '레디니스 체크 (트래픽 수신 준비)' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ok' }
    } catch {
      return { status: 'error', message: 'Database not ready' }
    }
  }
}
