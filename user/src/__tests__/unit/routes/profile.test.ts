import request from 'supertest';
import express from 'express';

// Mock dependencies before importing the route
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}));

jest.mock('../../../services/cache-service', () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    invalidatePattern: jest.fn(),
  })),
}));

jest.mock('../../../services/event-service', () => ({
  EventService: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    publish: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('redis', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  })),
}));

// Now import the route
import { profileRouter } from '../../../routes/profile';

// Mock auth middleware
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'test-auth-id' };
  next();
};

describe('Profile Routes', () => {
  let app: express.Application;
  let mockPrisma: any;

  beforeAll(() => {
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/profile', mockAuth, profileRouter);
    jest.clearAllMocks();
  });

  describe('GET /profile/:username', () => {
    it('should return user profile when user exists', async () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        displayName: 'Test User',
        bio: 'Test bio',
        avatarUrl: 'https://example.com/avatar.jpg',
        followersCount: 10,
        followingCount: 20,
        postsCount: 5,
        isPrivate: false,
        isVerified: true,
        createdAt: new Date('2023-01-01'),
        interests: [],
        badges: [],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/profile/testuser')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('id', mockUser.id);
      expect(response.body).toHaveProperty('username', mockUser.username);
      expect(response.body).not.toHaveProperty('authId');
    });

    it('should return 404 when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/profile/nonexistent')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({ error: 'User not found' });
    });
  });

  describe('PUT /profile', () => {
    it('should update user profile with valid data', async () => {
      const updateData = {
        displayName: 'Updated Name',
        bio: 'Updated bio',
        location: 'New York',
      };

      const mockUpdatedUser = {
        id: '123',
        authId: 'test-auth-id',
        username: 'testuser',
        ...updateData,
      };

      mockPrisma.user.update.mockResolvedValue(mockUpdatedUser);

      const response = await request(app)
        .put('/profile')
        .set('Authorization', 'Bearer test-token')
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { authId: 'test-auth-id' },
        data: updateData,
      });
      expect(response.body).toMatchObject(updateData);
    });

    it('should reject invalid display name', async () => {
      const response = await request(app)
        .put('/profile')
        .set('Authorization', 'Bearer test-token')
        .send({ displayName: 'a' }) // Too short
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject invalid website URL', async () => {
      const response = await request(app)
        .put('/profile')
        .set('Authorization', 'Bearer test-token')
        .send({ website: 'not-a-url' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});