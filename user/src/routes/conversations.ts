import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { conversationService, prisma } from '../services';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';

export const conversationsRouter = Router();

/**
 * @swagger
 * /api/v1/conversations:
 *   post:
 *     summary: Create or get existing conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The other user's ID
 */
conversationsRouter.post('/',
  body('userId').isUUID().withMessage('Invalid user ID'),
  validate,
  asyncHandler(async (req, res) => {
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    const conversation = await conversationService.createConversation(
      currentUser.id,
      req.body.userId
    );

    res.json(conversation);
  })
);

/**
 * @swagger
 * /api/v1/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Items per page
 */
conversationsRouter.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
  asyncHandler(async (req, res) => {
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    const page = parseInt(req.query?.page as string) || 1;
    const limit = parseInt(req.query?.limit as string) || 20;

    const result = await conversationService.getConversations(currentUser.id, page, limit);
    res.json(result);
  })
);

/**
 * @swagger
 * /api/v1/conversations/{conversationId}:
 *   get:
 *     summary: Get a specific conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 */
conversationsRouter.get('/:conversationId',
  param('conversationId').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    const conversation = await conversationService.getConversation(
      req.params.conversationId,
      currentUser.id
    );

    res.json(conversation);
  })
);

/**
 * @swagger
 * /api/v1/conversations/{conversationId}/read:
 *   post:
 *     summary: Mark conversation as read
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 */
conversationsRouter.post('/:conversationId/read',
  param('conversationId').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    const result = await conversationService.markAsRead(
      req.params.conversationId,
      currentUser.id
    );

    res.json(result);
  })
);

/**
 * @swagger
 * /api/v1/conversations/{conversationId}/mute:
 *   post:
 *     summary: Mute or unmute a conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mutedUntil:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: When to unmute (null to unmute immediately)
 */
conversationsRouter.post('/:conversationId/mute',
  param('conversationId').isUUID(),
  body('mutedUntil').optional().isISO8601().toDate(),
  validate,
  asyncHandler(async (req, res) => {
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    const result = await conversationService.muteConversation(
      req.params.conversationId,
      currentUser.id,
      req.body.mutedUntil || null
    );

    res.json(result);
  })
);

/**
 * @swagger
 * /api/v1/conversations/{conversationId}/leave:
 *   post:
 *     summary: Leave a conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 */
conversationsRouter.post('/:conversationId/leave',
  param('conversationId').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const currentUser = await prisma.user.findUnique({
      where: { authId: req.user!.id }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    const result = await conversationService.leaveConversation(
      req.params.conversationId,
      currentUser.id
    );

    res.json(result);
  })
);