import { Module } from '@nestjs/common'
import { CategoriesController } from './categories.controller'
import { CategoriesService } from './categories.service'
import { AuthModule } from '../auth/auth.module'
import { TaxonomyModule } from '../taxonomy/taxonomy.module'

@Module({
  imports: [AuthModule, TaxonomyModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
