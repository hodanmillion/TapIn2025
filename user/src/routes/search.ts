import { Router } from 'express';
import { query } from 'express-validator';
import { prisma } from '../services';
import { cacheService } from '../services';

export const searchRouter = Router();

/**
 * @swagger
 * /api/v1/search/users:
 *   get:
 *     summary: Search users
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 */
searchRouter.get('/users',
  query('q').isString().isLength({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req, res) => {
    const searchQuery = req.query?.q as string;
    const page = parseInt(req.query?.page as string) || 1;
    const limit = parseInt(req.query?.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Cache key
    const cacheKey = `search:users:${searchQuery}:${page}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: searchQuery, mode: 'insensitive' } },
          { displayName: { contains: searchQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
        followersCount: true,
      },
      skip,
      take: limit,
      orderBy: [
        { isVerified: 'desc' },
        { followersCount: 'desc' },
      ],
    });

    const total = await prisma.user.count({
      where: {
        OR: [
          { username: { contains: searchQuery, mode: 'insensitive' } },
          { displayName: { contains: searchQuery, mode: 'insensitive' } },
        ],
      },
    });

    const result = {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes
    await cacheService.set(cacheKey, result, 300);

    res.json(result);
  }
);