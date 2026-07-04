import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { CloudinaryStorageService } from './cloudinary-storage.service';

@Injectable()
export class StorageFactoryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly localStorageService: LocalStorageService,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  getStorageService(): IStorageService {
    const storageType = this.configService.get<string>('STORAGE_TYPE', 'local');

    switch (storageType) {
      case 'cloudinary':
        return this.cloudinaryStorageService;
      case 'local':
      default:
        return this.localStorageService;
    }
  }
}
