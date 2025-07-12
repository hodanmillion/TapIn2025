import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';

export class S3Service {
  private s3: S3Client | null;
  private bucketName: string;
  private isLocalMode: boolean;
  private localStoragePath: string;

  constructor() {
    // Force local mode in development or when USE_LOCAL_STORAGE is set
    this.isLocalMode = process.env.NODE_ENV === 'development' || process.env.USE_LOCAL_STORAGE === 'true';
    this.localStoragePath = path.join(process.cwd(), 'uploads');
    
    if (this.isLocalMode) {
      console.log('S3Service: Running in local mode, storing files locally');
      this.s3 = null;
      this.bucketName = 'local';
      // Ensure uploads directory exists
      fs.mkdir(this.localStoragePath, { recursive: true }).catch(console.error);
    } else {
      this.s3 = new S3Client({
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      this.bucketName = process.env.S3_BUCKET_NAME!;
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.isLocalMode) {
      // Local file storage for development
      const filePath = path.join(this.localStoragePath, key);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, body);
      return `/uploads/${key}`;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.s3!.send(command);
    return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
  }

  async delete(key: string): Promise<void> {
    if (this.isLocalMode) {
      const filePath = path.join(this.localStoragePath, key);
      await fs.unlink(filePath).catch(() => {
        // Ignore if file doesn't exist
      });
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3!.send(command);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.isLocalMode) {
      // For local mode, just return the file path
      return `/uploads/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3!, command, { expiresIn });
  }
}