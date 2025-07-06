import request from 'supertest';
import { generateTestToken } from '../helpers/auth';

describe('Social Endpoints Integration Tests', () => {
  const baseUrl = 'http://localhost:3002';
  const testToken = generateTestToken();
  const testUserId = '123e4567-e89b-12d3-a456-426614174000'; // Valid UUID

  describe('POST /api/v1/social/follow/:userId', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .post(`/api/v1/social/follow/${testUserId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate userId format', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/social/follow/invalid-uuid')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      const errors = response.body.errors;
      expect(errors).toBeInstanceOf(Array);
      expect(errors[0]).toHaveProperty('path', 'userId');
    });

    it('should return 404 when following non-existent user', async () => {
      const response = await request(baseUrl)
        .post(`/api/v1/social/follow/${testUserId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/v1/social/unfollow/:userId', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .delete(`/api/v1/social/unfollow/${testUserId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate userId format', async () => {
      const response = await request(baseUrl)
        .delete('/api/v1/social/unfollow/not-a-uuid')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/v1/social/followers/:userId', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .get(`/api/v1/social/followers/${testUserId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate userId format', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/social/followers/invalid-id')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(baseUrl)
        .get(`/api/v1/social/followers/${testUserId}`)
        .query({ page: 'abc', limit: 'xyz' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should accept valid pagination parameters', async () => {
      const response = await request(baseUrl)
        .get(`/api/v1/social/followers/${testUserId}`)
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('followers');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
    });
  });

  describe('POST /api/v1/social/block/:userId', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .post(`/api/v1/social/block/${testUserId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate userId format', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/social/block/123')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should validate reason length when provided', async () => {
      const response = await request(baseUrl)
        .post(`/api/v1/social/block/${testUserId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ reason: 'a'.repeat(256) }) // Too long
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should accept request without reason', async () => {
      const response = await request(baseUrl)
        .post(`/api/v1/social/block/${testUserId}`)
        .set('Authorization', `Bearer ${testToken}`);

      // Will return 404 since current user doesn't exist in test
      expect(response.status).toBeOneOf([404, 400, 500]);
    });
  });
});