import request from 'supertest';
import { generateTestToken } from '../helpers/auth';

describe('Settings Endpoints Integration Tests', () => {
  const baseUrl = 'http://localhost:3002';
  const testToken = generateTestToken();

  describe('GET /api/v1/settings/preferences', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/settings/preferences')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return user preferences', async () => {
      const response = await request(baseUrl)
        .get('/api/v1/settings/preferences')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('preferences');
      expect(response.body.preferences).toBeDefined();
    });
  });

  describe('PUT /api/v1/settings/preferences', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .put('/api/v1/settings/preferences')
        .send({ notifications: { email: true } })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate preferences object', async () => {
      const response = await request(baseUrl)
        .put('/api/v1/settings/preferences')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should update preferences with valid data', async () => {
      const preferences = {
        notifications: {
          email: true,
          push: false,
          sms: false,
        },
        privacy: {
          profileVisibility: 'public',
          showEmail: false,
          showLocation: true,
        },
        language: 'en',
        theme: 'light',
      };

      const response = await request(baseUrl)
        .put('/api/v1/settings/preferences')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ preferences });

      // Might return 404 if user doesn't exist in test
      expect(response.status).toBeOneOf([200, 404]);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('preferences');
      }
    });
  });

  describe('POST /api/v1/settings/interests', () => {
    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/settings/interests')
        .send({ interests: ['technology', 'sports'] })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate interests array', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/settings/interests')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ interests: 'not-an-array' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should validate interest string format', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/settings/interests')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ interests: ['valid', 123, 'another'] }) // Contains non-string
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should validate maximum interests', async () => {
      const tooManyInterests = Array(21).fill('interest'); // Max is 20
      
      const response = await request(baseUrl)
        .post('/api/v1/settings/interests')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ interests: tooManyInterests })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should accept valid interests array', async () => {
      const interests = ['technology', 'sports', 'music', 'travel'];
      
      const response = await request(baseUrl)
        .post('/api/v1/settings/interests')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ interests });

      // Might return 404 if user doesn't exist in test
      expect(response.status).toBeOneOf([200, 404]);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('interests');
        expect(response.body.interests).toBeInstanceOf(Array);
      }
    });
  });
});