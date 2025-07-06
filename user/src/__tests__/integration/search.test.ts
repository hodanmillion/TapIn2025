import request from 'supertest';
import { generateTestToken } from '../helpers/auth';

describe('Search Endpoints Integration Tests', () => {
  const baseUrl = 'http://localhost:3002';
  const testToken = generateTestToken();

  describe('GET /api/v1/search/users', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ q: 'test' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should require search query', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      const errors = response.body.errors;
      expect(errors).toBeInstanceOf(Array);
      expect(errors[0]).toHaveProperty('path', 'q');
    });

    it('should validate query length', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ q: '' }) // Empty query
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should validate query max length', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ q: 'a'.repeat(101) }) // Max is 100
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ 
          q: 'test',
          page: 'invalid',
          limit: 'invalid' 
        })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(1);
    });

    it('should validate page minimum', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ 
          q: 'test',
          page: 0 // Min is 1
        })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should validate limit maximum', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ 
          q: 'test',
          limit: 51 // Max is 50
        })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should search users with valid parameters', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ 
          q: 'test',
          page: 1,
          limit: 10
        })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it('should search users with default pagination', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20); // Default limit
    });

    it('should handle special characters in search query', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ q: '@user#name' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
    });
  });
});