import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { z } from 'zod';
import { prisma, cacheService, eventService } from '../services';
import { UpdateProfileDto } from '../types';

export const profileRouter = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  dateOfBirth: z.string().datetime().optional(),
  isPrivate: z.boolean().optional(),
});

/**
 * @swagger
 * /api/v1/profile/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
profileRouter.get('/me', async (req, res) => {
  const cacheKey = `user:${req.user!.id}`;
  
  // Check cache
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const user = await prisma.user.findUnique({
    where: { authId: req.user!.id },
    include: {
      interests: {
        include: { interest: true },
      },
      badges: {
        include: { badge: true },
      },
      _count: {
        select: {
          followers: true,
          following: true,
        },
      },
    },
  });

  if (!user) {
    // Create user profile if it doesn't exist
    const newUser = await prisma.user.create({
      data: {
        authId: req.user!.id,
        username: req.user!.username,
        displayName: req.user!.username,
      },
    });
    
    await cacheService.set(cacheKey, newUser, 300); // Cache for 5 minutes
    return res.json(newUser);
  }

  // Update cache
  await cacheService.set(cacheKey, user, 300);
  
  res.json(user);
});

/**
 * @swagger
 * /api/v1/profile/me:
 *   put:
 *     summary: Update current user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 */
profileRouter.put('/me', async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    
    const user = await prisma.user.update({
      where: { authId: req.user!.id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await cacheService.delete(`user:${req.user!.id}`);
    
    // Emit profile updated event
    await eventService.publish('user.profile.updated', {
      userId: user.id,
      changes: data,
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    throw error;
  }
});

/**
 * @swagger
 * /api/v1/profile/{username}:
 *   get:
 *     summary: Get user profile by username
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 */
profileRouter.get('/:username', 
  param('username').isAlphanumeric().isLength({ min: 3, max: 50 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await prisma.user.findUnique({
      where: { username: req.params?.username },
      include: {
        interests: {
          include: { interest: true },
        },
        badges: {
          include: { badge: true },
        },
        _count: {
          select: {
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if blocked
    const block = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: user.id,
          blockedId: req.user!.id,
        },
      },
    });

    if (block) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if current user is following this user
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    let isFollowing = false;
    let following = null;

    if (currentUser && currentUser.id !== user.id) {
      following = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUser.id,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!following;
    }

    // Check if private profile and not following
    if (user.isPrivate && user.authId !== req.user!.id) {
      if (!following) {
        // Return limited info for private profiles
        return res.json({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isPrivate: true,
          isFollowing: false,
          _count: user._count,
        });
      }
    }

    res.json({
      ...user,
      isFollowing,
    });
  }
);