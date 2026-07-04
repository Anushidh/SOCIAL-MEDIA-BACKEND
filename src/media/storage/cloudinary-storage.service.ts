import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { IStorageService } from './storage.interface';

@Injectable()
export class CloudinaryStorageService implements IStorageService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // Auto-format and auto-quality for optimal delivery
          fetch_format: 'auto',
          quality: 'auto',
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                `Cloudinary upload failed: ${error?.message ?? 'unknown error'}`,
              ),
            );
            return;
          }
          resolve(result.secure_url);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async delete(fileUrl: string): Promise<void> {
    try {
      // Extract public_id from the Cloudinary URL
      // URL format: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<folder>/<public_id>.<ext>
      const urlParts = fileUrl.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      if (uploadIndex === -1) return;

      // Everything after "upload/v<version>/" is the public_id (with folder)
      const withVersion = urlParts.slice(uploadIndex + 1);
      // Skip the version segment (starts with 'v' followed by digits)
      const pathParts = withVersion[0]?.match(/^v\d+$/)
        ? withVersion.slice(1)
        : withVersion;

      const publicIdWithExt = pathParts.join('/');
      // Remove extension
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');

      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error deleting Cloudinary asset:', error);
    }
  }
}
