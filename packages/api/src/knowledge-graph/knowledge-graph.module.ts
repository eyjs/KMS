import { Module } from '@nestjs/common'
import { KnowledgeGraphController } from './knowledge-graph.controller'
import { KnowledgeGraphService } from './knowledge-graph.service'
import { AuthModule } from '../auth/auth.module'
import { CategoriesModule } from '../categories/categories.module'

@Module({
  imports: [AuthModule, CategoriesModule],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
