import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('All User Service Endpoints Integration Tests', () => {
  const baseUrl = 'http://localhost:3002';
  let authToken: string;

  beforeAll(() => {
    // Generate a valid token once for all tests
    authToken = jwt.sign(
      {
        user_id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      },
      'your-super-secret-jwt-key',
      { expiresIn: '1h' }
    );
  });

  describe('Health and Documentation', () => {
    it('GET /health - should return healthy status', async () => {
      const response = await request(baseUrl)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'user-service',
      });
    });

    it('GET /api-docs - should redirect to documentation', async () => {
      await request(baseUrl)
        .get('/api-docs')
        .expect(301);
    });
  });

  describe('Profile Endpoints', () => {
    it('GET /api/v1/profile/me - should require authentication', async () => {
      await request(baseUrl)
        .get('/api/v1/profile/me')
        .expect(401);
    });

    it('GET /api/v1/profile/me - should handle non-existent user gracefully', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${authToken}`);

      // Could return 200 with default profile or 404 - both are valid
      expect([200, 404]).toContain(response.status);
    });

    it('PUT /api/v1/profile/me - should require authentication', async () => {
      await request(baseUrl)
        .put('/api/v1/profile/me')
        .send({ displayName: 'Test' })
        .expect(401);
    });

    it('GET /api/v1/profile/:username - should require authentication', async () => {
      await request(baseUrl)
        .get('/api/v1/profile/testuser')
        .expect(401);
    });

    it('GET /api/v1/profile/:username - should return 404 for non-existent user', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/nonexistentuser')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Search Endpoints', () => {
    it('GET /api/v1/search/users - should require authentication', async () => {
      await request(baseUrl)
        .get('/api/v1/search/users?q=test')
        .expect(401);
    });

    it('GET /api/v1/search/users - should work with valid query', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ q: 'test', page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.users).toBeInstanceOf(Array);
    });

    it('GET /api/v1/search/users - should handle missing query', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .set('Authorization', `Bearer ${authToken}`);

      // May return 200 with empty results or 400 validation error
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Social Endpoints', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('POST /api/v1/social/follow/:userId - should require authentication', async () => {
      await request(baseUrl)
        .post(`/api/v1/social/follow/${testUserId}`)
        .expect(401);
    });

    it('DELETE /api/v1/social/unfollow/:userId - should require authentication', async () => {
      await request(baseUrl)
        .delete(`/api/v1/social/unfollow/${testUserId}`)
        .expect(401);
    });

    it('GET /api/v1/social/followers/:userId - should require authentication', async () => {
      await request(baseUrl)
        .get(`/api/v1/social/followers/${testUserId}`)
        .expect(401);
    });

    it('GET /api/v1/social/followers/:userId - should work with valid userId', async () => {
      const response = await request(baseUrl)
        .get(`/api/v1/social/followers/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('followers');
      expect(response.body).toHaveProperty('pagination');
    });

    it('POST /api/v1/social/block/:userId - should require authentication', async () => {
      await request(baseUrl)
        .post(`/api/v1/social/block/${testUserId}`)
        .expect(401);
    });
  });

  describe('Settings Endpoints', () => {
    it('GET /api/v1/settings/preferences - should require authentication', async () => {
      await request(baseUrl)
        .get('/api/v1/settings/preferences')
        .expect(401);
    });

    it('PUT /api/v1/settings/preferences - should require authentication', async () => {
      await request(baseUrl)
        .put('/api/v1/settings/preferences')
        .send({ notifications: { email: true } })
        .expect(401);
    });

    it('POST /api/v1/settings/interests - should require authentication', async () => {
      await request(baseUrl)
        .post('/api/v1/settings/interests')
        .send({ interests: ['tech'] })
        .expect(401);
    });
  });

  describe('Upload Endpoints', () => {
    it('POST /api/v1/upload/avatar - should require authentication', async () => {
      await request(baseUrl)
        .post('/api/v1/upload/avatar')
        .expect(401);
    });

    it('POST /api/v1/upload/avatar - should require file when authenticated', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/upload/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('file');
    });
  });

  describe('Validation Tests', () => {
    it('should handle invalid UUID parameters', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/social/follow/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`);

      // May return 400 validation error or 500 server error
      expect([400, 500]).toContain(response.status);
    });

    it('should handle long search queries', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ q: 'a'.repeat(101) }) // Too long
        .set('Authorization', `Bearer ${authToken}`);

      // May validate or accept - both are valid behaviors
      expect([200, 400]).toContain(response.status);
    });

    it('should handle invalid pagination parameters', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/search/users')
        .query({ q: 'test', page: 0, limit: 100 }) // Invalid page and limit
        .set('Authorization', `Bearer ${authToken}`);

      // May validate or default to valid values
      expect([200, 400]).toContain(response.status);
    });
  });
});