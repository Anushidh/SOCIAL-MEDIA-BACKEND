export interface IStorageService {
  upload(file: Express.Multer.File, folder: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
  getSignedUrl?(fileUrl: string, expiresIn?: number): Promise<string>;
}

export interface UploadResult {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}
