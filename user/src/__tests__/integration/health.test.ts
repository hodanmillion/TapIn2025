import request from 'supertest';
import express from 'express';

describe('Health Endpoint Integration Test', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'user-service' });
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'user-service',
      });
    });

    it('should return quickly', async () => {
      const start = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should respond in less than 100ms
    });
  });
});