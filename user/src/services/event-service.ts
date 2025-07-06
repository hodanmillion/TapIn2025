import * as amqp from 'amqplib';
import { logger } from '../utils/logger';

export class EventService {
  private connection?: any;
  private channel?: any;

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
      this.channel = await this.connection.createChannel();
      
      // Declare exchange
      await this.channel.assertExchange('user-events', 'topic', { durable: true });
      
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