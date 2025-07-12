import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '../services';
import { eventService, cacheService } from '../services';
import { PaginationQuery } from '../types';
import { blockRouter } from './social.block';

export const socialRouter = Router();

// Mount block routes
socialRouter.use(blockRouter);

/**
 * @swagger
 * /api/v1/social/follow/{userId}:
 *   post:
 *     summary: Follow a user
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialRouter.post('/follow/:userId',
  param('userId').isUUID(),
  async (req, res) => {
    const { userId } = req.params!;
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (currentUser.id === userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: userId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already following' });
    }

    // Check if blocked
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: currentUser.id },
          { blockerId: currentUser.id, blockedId: userId },
        ],
      },
    });

    if (block) {
      return res.status(403).json({ error: 'Cannot follow this user' });
    }

    // Create follow
    const follow = await prisma.follow.create({
      data: {
        followerId: currentUser.id,
        followingId: userId,
      },
    });

    // Update counts
    await prisma.$transaction([
      prisma.user.update({
        where: { id: currentUser.id },
        data: { followingCount: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { followersCount: { increment: 1 } },
      }),
    ]);

    // Invalidate caches
    await Promise.all([
      cacheService.delete(`user:${currentUser.authId}`),
      cacheService.delete(`followers:${userId}`),
      cacheService.delete(`following:${currentUser.id}`),
    ]);

    // Emit event
    await eventService.publish('user.followed', {
      followerId: currentUser.id,
      followingId: userId,
    });

    res.json({ success: true });
  }
);

/**
 * @swagger
 * /api/v1/social/unfollow/{userId}:
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialRouter.delete('/unfollow/:userId',
  param('userId').isUUID(),
  async (req, res) => {
    const { userId } = req.params!;
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: userId,
        },
      },
    });

    if (!follow) {
      return res.status(400).json({ error: 'Not following' });
    }

    // Delete follow
    await prisma.follow.delete({
      where: { id: follow.id },
    });

    // Update counts
    await prisma.$transaction([
      prisma.user.update({
        where: { id: currentUser.id },
        data: { followingCount: { decrement: 1 } },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);

    // Invalidate caches
    await Promise.all([
      cacheService.delete(`user:${currentUser.authId}`),
      cacheService.delete(`followers:${userId}`),
      cacheService.delete(`following:${currentUser.id}`),
    ]);

    res.json({ success: true });
  }
);

/**
 * @swagger
 * /api/v1/social/followers/{userId}:
 *   get:
 *     summary: Get user followers
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialRouter.get('/followers/:userId',
  param('userId').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const { userId } = req.params!;
    const page = parseInt(req.query?.page as string) || 1;
    const limit = parseInt(req.query?.limit as string) || 20;
    const skip = (page - 1) * limit;

    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
    });

    const total = await prisma.follow.count({
      where: { followingId: userId },
    });

    res.json({
      followers: followers.map(f => f.follower),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }
);

/**
 * @swagger
 * /api/v1/social/block/{userId}:
 *   post:
 *     summary: Block a user
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
socialRouter.post('/block/:userId',
  param('userId').isUUID(),
  body('reason').optional().isString().isLength({ max: 255 }),
  async (req, res) => {
    const { userId } = req.params!;
    const { reason } = req.body;
    
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (currentUser.id === userId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check if already blocked
    const existing = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: currentUser.id,
          blockedId: userId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already blocked' });
    }

    // Create block and remove any follows
    await prisma.$transaction([
      prisma.block.create({
        data: {
          blockerId: currentUser.id,
          blockedId: userId,
          reason,
        },
      }),
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: currentUser.id, followingId: userId },
            { followerId: userId, followingId: currentUser.id },
          ],
        },
      }),
    ]);

    // Emit event
    await eventService.publish('user.blocked', {
      blockerId: currentUser.id,
      blockedId: userId,
    });

    res.json({ success: true });
  }
);