import { Module } from '@nestjs/common'
import { PlacementsController } from './placements.controller'
import { PlacementsService } from './placements.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [PlacementsController],
  providers: [PlacementsService],
  exports: [PlacementsService],
})
export class PlacementsModule {}
