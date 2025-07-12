import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { CacheService } from './cache-service';
import { EventService } from './event-service';
import { QueueService } from './queue-service';
import { S3Service } from './s3-service';

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Redis
export const redis = createClient({
  url: process.env.REDIS_URL,
});

// Initialize services
export const cacheService = new CacheService(redis);
export const eventService = new EventService();
export const queueService = new QueueService();
export const s3Service = new S3Service();

// Export other services
export * from './block.service';
export * from './conversation.service';