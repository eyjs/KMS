import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { RequestIdMiddleware } from './common/middleware/request-id.middleware'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { DocumentsModule } from './documents/documents.module'
import { RelationsModule } from './relations/relations.module'
import { TaxonomyModule } from './taxonomy/taxonomy.module'
import { CategoriesModule } from './categories/categories.module'
import { PlacementsModule } from './placements/placements.module'
import { FeedbackModule } from './feedback/feedback.module'
import { GroupsModule } from './groups/groups.module'
import { HealthModule } from './health/health.module'
import { WebhooksModule } from './webhooks/webhooks.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,    // 1초
        limit: 10,    // 초당 10회
      },
      {
        name: 'medium',
        ttl: 60000,   // 1분
        limit: 100,   // 분당 100회
      },
      {
        name: 'long',
        ttl: 3600000, // 1시간
        limit: 1000,  // 시간당 1000회
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    TaxonomyModule,
    CategoriesModule,
    DocumentsModule,
    PlacementsModule,
    RelationsModule,
    FeedbackModule,
    GroupsModule,
    WebhooksModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
