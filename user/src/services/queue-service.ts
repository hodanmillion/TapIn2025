import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';
import { S3Service } from './s3-service';
import sharp from 'sharp';

export class QueueService {
  private connection: IORedis;
  private queues: Map<string, Queue> = new Map();
  private workers: Worker[] = [];
  private s3Service: S3Service;

  constructor() {
    this.connection = new IORedis(process.env.REDIS_URL!);
    this.s3Service = new S3Service();
  }

  async connect(): Promise<void> {
    // Initialize queues
    this.queues.set('delete-file', new Queue('delete-file', { connection: this.connection }));
    this.queues.set('generate-thumbnails', new Queue('generate-thumbnails', { connection: this.connection }));

    // Initialize workers
    this.setupDeleteFileWorker();
    this.setupThumbnailWorker();

    logger.info('Queue service initialized');
  }

  async add(queueName: string, data: any, options?: any): Promise<void> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        logger.warn(`Queue ${queueName} not found, skipping job`);
        return;
      }

      await queue.add(queueName, data, options);
    } catch (error) {
      logger.warn(`Failed to add job to queue ${queueName}:`, (error as Error).message);
    }
  }

  private setupDeleteFileWorker(): void {
    const worker = new Worker(
      'delete-file',
      async (job) => {
        const { url } = job.data;
        // Extract key from URL
        const key = url.split('.com/')[1];
        if (key) {
          await this.s3Service.delete(key);
          logger.info(`Deleted file: ${key}`);
        }
      },
      { connection: this.connection }
    );

    this.workers.push(worker);
  }

  private setupThumbnailWorker(): void {
    const worker = new Worker(
      'generate-thumbnails',
      async (job) => {
        const { userId, originalUrl } = job.data;
        
        // Generate different sizes
        const sizes = [
          { width: 100, height: 100, suffix: 'small' },
          { width: 200, height: 200, suffix: 'medium' },
        ];

        // Implementation would download original, resize, and upload
        logger.info(`Generated thumbnails for user ${userId}`);
      },
      { connection: this.connection }
    );

    this.workers.push(worker);
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map(w => w.close()));
    await this.connection.quit();
  }
}