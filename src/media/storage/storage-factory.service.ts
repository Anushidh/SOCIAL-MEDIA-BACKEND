import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';

@Injectable()
export class StorageFactoryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly localStorageService: LocalStorageService,
    private readonly s3StorageService: S3StorageService,
  ) {}

  getStorageService(): IStorageService {
    const storageType = this.configService.get<string>('STORAGE_TYPE', 'local');

    switch (storageType) {
      case 's3':
        return this.s3StorageService;
      case 'local':
      default:
        return this.localStorageService;
    }
  }
}
