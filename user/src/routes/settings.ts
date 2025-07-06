import { Router } from 'express';
import { body } from 'express-validator';
import { prisma } from '../services';
import { UserPreferences } from '../types';

export const settingsRouter = Router();

/**
 * @swagger
 * /api/v1/settings/preferences:
 *   get:
 *     summary: Get user preferences
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
settingsRouter.get('/preferences', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { authId: req.user!.id },
    select: { preferences: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user.preferences || {
    emailNotifications: true,
    pushNotifications: true,
    theme: 'auto',
    language: 'en',
  });
});

/**
 * @swagger
 * /api/v1/settings/preferences:
 *   put:
 *     summary: Update user preferences
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
settingsRouter.put('/preferences',
  body('emailNotifications').optional().isBoolean(),
  body('pushNotifications').optional().isBoolean(),
  body('theme').optional().isIn(['light', 'dark', 'auto']),
  body('language').optional().isString(),
  async (req, res) => {
    const preferences = req.body as Partial<UserPreferences>;

    const user = await prisma.user.update({
      where: { authId: req.user!.id },
      data: {
        preferences: preferences as any,
      },
      select: { preferences: true },
    });

    res.json(user.preferences);
  }
);

/**
 * @swagger
 * /api/v1/settings/interests:
 *   post:
 *     summary: Update user interests
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 */
settingsRouter.post('/interests',
  body('interests').isArray(),
  body('interests.*').isString(),
  async (req, res) => {
    const { interests } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove existing interests
    await prisma.userInterest.deleteMany({
      where: { userId: user.id },
    });

    // Add new interests
    const interestRecords = await Promise.all(
      interests.map(async (name: string) => {
        const interest = await prisma.interest.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        return { userId: user.id, interestId: interest.id };
      })
    );

    await prisma.userInterest.createMany({
      data: interestRecords,
    });

    res.json({ success: true });
  }
);