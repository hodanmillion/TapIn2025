import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import 'express-async-errors';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';

dotenv.config();

const app = express();

// Mock services for development
export const cacheService = {
  async get(key: string) { return null; },
  async set(key: string, value: any, ttl?: number) {},
  async delete(key: string) {},
  async invalidatePattern(pattern: string) {}
};

export const eventService = {
  async publish(event: string, data: any) {
    logger.debug(`[MOCK] Published event: ${event}`, data);
  }
};

export const s3Service = {
  async upload(key: string, body: Buffer, contentType: string) {
    return `https://mock-bucket.s3.amazonaws.com/${key}`;
  },
  async delete(key: string) {}
};

export const queueService = {
  async add(queueName: string, data: any, options?: any) {
    logger.debug(`[MOCK] Added job to queue ${queueName}`, data);
  }
};

// Mock Prisma for development
export const prisma = {
  user: {
    async findUnique(params: any) {
      logger.debug('[MOCK] Prisma findUnique:', params);
      return null;
    },
    async create(params: any) {
      logger.debug('[MOCK] Prisma create:', params);
      return {
        id: 'mock-user-id',
        authId: 'mock-auth-id',
        username: 'mockuser',
        displayName: 'Mock User',
        ...params.data
      };
    },
    async update(params: any) {
      logger.debug('[MOCK] Prisma update:', params);
      return { id: 'mock-user-id', ...params.data };
    }
  }
};

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Service API',
      version: '1.0.0',
      description: 'User profile and social features API (Development Mode)',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3002}`,
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const specs = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'user-service',
    mode: 'development',
    message: 'Running with mock services - no external dependencies required'
  });
});

// Mock auth middleware for development
app.use('/api/v1', (req, res, next) => {
  req.user = {
    id: 'dev-user-123',
    email: 'dev@example.com',
    username: 'devuser'
  };
  next();
});

// Basic routes for testing
app.get('/api/v1/profile/me', async (req, res) => {
  res.json({
    id: 'mock-user-id',
    authId: req.user!.id,
    username: req.user!.username,
    displayName: 'Development User',
    bio: 'This is a mock user for development',
    isPrivate: false,
    followersCount: 42,
    followingCount: 23,
    postsCount: 15
  });
});

app.get('/api/v1/search/users', async (req, res) => {
  const searchQuery = req.query.q as string;
  res.json({
    users: [
      {
        id: 'user-1',
        username: `${searchQuery}_user1`,
        displayName: `${searchQuery} User 1`,
        avatarUrl: null,
        isVerified: false,
        followersCount: 10
      },
      {
        id: 'user-2', 
        username: `${searchQuery}_user2`,
        displayName: `${searchQuery} User 2`,
        avatarUrl: null,
        isVerified: true,
        followersCount: 25
      }
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      pages: 1
    }
  });
});

// Error handler
app.use(errorHandler);

// Start server
const port = process.env.PORT || 3002;
app.listen(port, () => {
  logger.info(`🚀 User service started on port ${port} (Development Mode)`);
  logger.info(`📚 API docs available at http://localhost:${port}/api-docs`);
  logger.info(`🔍 Health check: http://localhost:${port}/health`);
  logger.info(`👤 Mock profile: http://localhost:${port}/api/v1/profile/me`);
  logger.info('⚠️  Using mock services - no database or external dependencies required');
});

export { app };