import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import { StorageFactoryService } from './storage/storage-factory.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dest: configService.get<string>('UPLOAD_DEST', './uploads'),
        limits: {
          fileSize: configService.get<number>(
            'MAX_FILE_SIZE',
            5 * 1024 * 1024,
          ),
        },
      }),
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, LocalStorageService, S3StorageService, StorageFactoryService],
  exports: [MediaService, StorageFactoryService],
})
export class MediaModule {}
