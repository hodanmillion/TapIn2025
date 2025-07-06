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
import { authMiddleware } from './middleware/auth';
import { profileRouter } from './routes/profile';
import { socialRouter } from './routes/social';
import { settingsRouter } from './routes/settings';
import { searchRouter } from './routes/search';
import { uploadRouter } from './routes/upload';
import { prisma, redis, cacheService, eventService, queueService } from './services';

dotenv.config();

const app = express();


// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Service API',
      version: '1.0.0',
      description: 'User profile and social features API',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}`,
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
  res.json({ status: 'healthy', service: 'user-service' });
});

// Routes
app.use('/api/v1/profile', authMiddleware, profileRouter);
app.use('/api/v1/social', authMiddleware, socialRouter);
app.use('/api/v1/settings', authMiddleware, settingsRouter);
app.use('/api/v1/search', authMiddleware, searchRouter);
app.use('/api/v1/upload', authMiddleware, uploadRouter);

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Try to connect to external services, but don't fail if they're not available in dev
    try {
      await redis.connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.warn('Redis not available, caching disabled:', (error as Error).message);
    }

    try {
      await eventService.connect();
      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.warn('RabbitMQ not available, events disabled:', (error as Error).message);
    }

    try {
      await queueService.connect();
      logger.info('Queue service initialized');
    } catch (error) {
      logger.warn('Queue service not available, background jobs disabled:', (error as Error).message);
    }
    
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      logger.info(`User service started on port ${port}`);
      logger.info(`API docs available at http://localhost:${port}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  await redis.quit();
  await eventService.close();
  await queueService.close();
  process.exit(0);
});

start();

