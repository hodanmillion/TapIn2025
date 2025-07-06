import request from 'supertest';

describe('User Service API Integration Tests', () => {
  const baseUrl = 'http://localhost:3002';

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(baseUrl)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'user-service',
      });
    });
  });

  describe('API Documentation', () => {
    it('should redirect to API docs', async () => {
      const response = await request(baseUrl)
        .get('/api-docs')
        .expect(301);

      expect(response.headers.location).toBe('/api-docs/');
    });
  });

  describe('Protected Routes', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Profile Routes', () => {
    it('should require authentication for profile lookup', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/nonexistentuser123456789')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});