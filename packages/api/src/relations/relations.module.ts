import { Module } from '@nestjs/common'
import { RelationsController } from './relations.controller'
import { RelationsService } from './relations.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [RelationsController],
  providers: [RelationsService],
  exports: [RelationsService],
})
export class RelationsModule {}
