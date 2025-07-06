import request from 'supertest';
import { generateTestToken } from '../helpers/auth';

describe('Profile Endpoints Integration Tests', () => {
  const baseUrl = 'http://localhost:3002';
  const testToken = generateTestToken();

  describe('GET /api/v1/profile/me', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 when user profile does not exist', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);

      expect(response.body).toEqual({ error: 'User not found' });
    });
  });

  describe('PUT /api/v1/profile/me', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .put('/api/v1/profile/me')
        .send({ displayName: 'Test User' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate display name length', async () => {
      const response = await request(baseUrl)
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ displayName: 'a' }) // Too short
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      const errors = response.body.errors;
      expect(errors).toBeInstanceOf(Array);
      expect(errors[0]).toHaveProperty('path', 'displayName');
    });

    it('should validate bio length', async () => {
      const response = await request(baseUrl)
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ bio: 'a'.repeat(501) }) // Too long
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      const errors = response.body.errors;
      expect(errors).toBeInstanceOf(Array);
      expect(errors[0]).toHaveProperty('path', 'bio');
    });

    it('should validate website URL format', async () => {
      const response = await request(baseUrl)
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ website: 'not-a-url' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      const errors = response.body.errors;
      expect(errors).toBeInstanceOf(Array);
      expect(errors[0]).toHaveProperty('path', 'website');
    });

    it('should validate date of birth', async () => {
      const response = await request(baseUrl)
        .put('/api/v1/profile/me')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ dateOfBirth: 'invalid-date' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/v1/profile/:username', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/testuser')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/nonexistentuser999')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);

      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should validate username parameter', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/profile/invalid username') // Contains space
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});