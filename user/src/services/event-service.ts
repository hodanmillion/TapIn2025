import * as amqp from 'amqplib';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export class EventService {
  private connection?: any;
  private channel?: any;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
      this.channel = await this.connection.createChannel();
      
      // Declare exchanges
      await this.channel.assertExchange('user-events', 'topic', { durable: true });
      await this.channel.assertExchange('user_events', 'topic', { durable: true }); // Auth service uses user_events
      
      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publish(event: string, data: any): Promise<void> {
    if (!this.channel) {
      logger.warn('Not connected to RabbitMQ, skipping event:', event);
      return;
    }

    try {
      const message = Buffer.from(JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
      }));

      this.channel.publish('user-events', event, message);
      logger.debug(`Published event: ${event}`);
    } catch (error) {
      logger.warn('Failed to publish event:', event, (error as Error).message);
    }
  }

  async startConsumer(): Promise<void> {
    if (!this.channel) {
      logger.error('Cannot start consumer: not connected to RabbitMQ');
      return;
    }

    try {
      // Create a queue for this service
      const queueName = 'user-service-queue';
      const queue = await this.channel.assertQueue(queueName, { durable: true });
      
      // Bind queue to user registration events
      await this.channel.bindQueue(queueName, 'user_events', 'user:register');
      
      // Start consuming messages
      await this.channel.consume(queueName, async (msg: any) => {
        if (!msg) return;
        
        try {
          const content = JSON.parse(msg.content.toString());
          logger.info('Received event:', content.type, content.user_id);
          
          if (content.type === 'user:register') {
            await this.handleUserRegistration(content);
          }
          
          // Acknowledge the message
          this.channel.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          // Reject the message and requeue it
          this.channel.nack(msg, false, true);
        }
      });
      
      logger.info('Started consuming user events');
    } catch (error) {
      logger.error('Failed to start consumer:', error);
      throw error;
    }
  }

  private async handleUserRegistration(event: any): Promise<void> {
    try {
      const { user_id, username, data } = event;
      
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { authId: user_id }
      });
      
      if (existingUser) {
        logger.info(`User profile already exists for ${username}`);
        return;
      }
      
      // Create user profile
      const user = await this.prisma.user.create({
        data: {
          authId: user_id,
          username: username,
          displayName: username,
        }
      });
      
      logger.info(`Created user profile for ${username} (${user.id})`);
      
      // Publish user created event
      await this.publish('user.created', {
        userId: user.id,
        authId: user_id,
        username: username
      });
    } catch (error) {
      logger.error('Error handling user registration:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      logger.warn('Error closing RabbitMQ connection:', (error as Error).message);
    }
  }
}