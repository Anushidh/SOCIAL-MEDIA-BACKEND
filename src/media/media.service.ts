import { Injectable, BadRequestException } from '@nestjs/common';
import { StorageFactoryService } from './storage/storage-factory.service';

@Injectable()
export class MediaService {
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  constructor(private readonly storageFactory: StorageFactoryService) {}

  validateFile(file: Express.Multer.File): void {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    this.validateFile(file);
    const storage = this.storageFactory.getStorageService();
    return storage.upload(file, folder);
  }

  async uploadFiles(files: Express.Multer.File[], folder: string): Promise<string[]> {
    return Promise.all(files.map((file) => this.uploadFile(file, folder)));
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const storage = this.storageFactory.getStorageService();
    return storage.delete(fileUrl);
  }
}
