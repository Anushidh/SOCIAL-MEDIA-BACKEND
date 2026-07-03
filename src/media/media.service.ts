import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MediaService {
  private readonly uploadDest: string;
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  constructor(private readonly configService: ConfigService) {
    this.uploadDest = this.configService.get<string>(
      'UPLOAD_DEST',
      './uploads',
    );
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadDest)) {
      fs.mkdirSync(this.uploadDest, { recursive: true });
    }
  }

  validateFile(file: Express.Multer.File): void {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  getFileUrl(filename: string): string {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    return `${appUrl}/uploads/${filename}`;
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.uploadDest, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
