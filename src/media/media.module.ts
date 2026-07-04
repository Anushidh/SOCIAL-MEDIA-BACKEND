import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalStorageService } from './storage/local-storage.service';
import { CloudinaryStorageService } from './storage/cloudinary-storage.service';
import { StorageFactoryService } from './storage/storage-factory.service';

@Module({
  imports: [
    // Use memory storage so any backend (local, Cloudinary) can receive file.buffer
    MulterModule.register({
      storage: memoryStorage(),
    }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalStorageService,
    CloudinaryStorageService,
    StorageFactoryService,
  ],
  exports: [MediaService, StorageFactoryService],
})
export class MediaModule {}
