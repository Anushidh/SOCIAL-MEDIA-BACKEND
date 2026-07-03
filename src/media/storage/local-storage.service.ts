import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from './storage.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    // File already saved by multer
    return `${this.appUrl}/uploads/${folder}/${file.filename}`;
  }

  async delete(fileUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const urlPath = new URL(fileUrl).pathname;
      const filename = urlPath.replace('/uploads/', '');
      const filePath = path.join(process.cwd(), 'uploads', filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
}
