import { Module } from '@nestjs/common'
import { RelationsController } from './relations.controller'
import { RelationsService } from './relations.service'
import { AuthModule } from '../auth/auth.module'
import { DocumentsModule } from '../documents/documents.module'
import { TaxonomyModule } from '../taxonomy/taxonomy.module'

@Module({
  imports: [AuthModule, DocumentsModule, TaxonomyModule],
  controllers: [RelationsController],
  providers: [RelationsService],
  exports: [RelationsService],
})
export class RelationsModule {}
