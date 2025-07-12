import { Router } from 'express';
import { param, query, body } from 'express-validator';
import { prisma } from '../services';

export const blockRouter = Router();

/**
 * @swagger
 * /api/v1/social/unblock/{userId}:
 *   delete:
 *     summary: Unblock a user
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
blockRouter.delete('/unblock/:userId',
  param('userId').isUUID(),
  async (req, res) => {
    const { userId } = req.params!;
    
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await prisma.block.deleteMany({
      where: {
        blockerId: currentUser.id,
        blockedId: userId,
      },
    });

    if (result.count === 0) {
      return res.status(400).json({ error: 'User is not blocked' });
    }

    res.json({ success: true });
  }
);

/**
 * @swagger
 * /api/v1/social/blocked:
 *   get:
 *     summary: Get list of blocked users
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
blockRouter.get('/blocked',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const page = parseInt(req.query?.page as string) || 1;
    const limit = parseInt(req.query?.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [blocks, total] = await Promise.all([
      prisma.block.findMany({
        where: { blockerId: currentUser.id },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.block.count({
        where: { blockerId: currentUser.id },
      }),
    ]);

    res.json({
      blocks: blocks.map(b => ({
        ...b.blocked,
        blockedAt: b.createdAt,
        reason: b.reason,
      })),
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
 * /api/v1/social/blocked/{userId}:
 *   get:
 *     summary: Check block relationship with a user
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
blockRouter.get('/blocked/:userId',
  param('userId').isUUID(),
  async (req, res) => {
    const { userId } = req.params!;
    
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [blocking, blockedBy] = await Promise.all([
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: currentUser.id,
            blockedId: userId,
          },
        },
      }),
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: currentUser.id,
          },
        },
      }),
    ]);

    res.json({
      blocking: !!blocking,
      blockedBy: !!blockedBy,
    });
  }
);