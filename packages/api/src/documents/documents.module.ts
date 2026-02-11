import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { AuthModule } from '../auth/auth.module'
import { diskStorage } from 'multer'
import { v4 as uuid } from 'uuid'
import * as path from 'path'

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          destination: config.get('STORAGE_PATH', './storage/originals'),
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname)
            cb(null, `${uuid()}${ext}`)
          },
        }),
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
        fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
          const allowed = ['.pdf', '.md', '.csv']
          const ext = path.extname(file.originalname).toLowerCase()
          if (allowed.includes(ext)) {
            cb(null, true)
          } else {
            cb(new Error(`허용되지 않는 파일 형식입니다: ${ext}`), false)
          }
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
