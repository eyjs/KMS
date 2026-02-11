import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { DocumentsModule } from './documents/documents.module'
import { RelationsModule } from './relations/relations.module'
import { TaxonomyModule } from './taxonomy/taxonomy.module'
import { FeedbackModule } from './feedback/feedback.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TaxonomyModule,
    DocumentsModule,
    RelationsModule,
    FeedbackModule,
  ],
})
export class AppModule {}
