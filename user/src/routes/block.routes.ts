import { Router } from 'express';
import { BlockService } from '../services/block.service';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export function createBlockRoutes(blockService: BlockService): Router {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  // Block a user
  router.post('/block/:userId', asyncHandler(async (req, res) => {
    const blockerId = req.user!.id;
    const blockedId = req.params.userId;
    const { reason } = req.body;

    const block = await blockService.blockUser(blockerId, blockedId, reason);
    res.json(block);
  }));

  // Unblock a user
  router.delete('/unblock/:userId', asyncHandler(async (req, res) => {
    const blockerId = req.user!.id;
    const blockedId = req.params.userId;

    const result = await blockService.unblockUser(blockerId, blockedId);
    res.json(result);
  }));

  // Get list of blocked users
  router.get('/blocked', asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await blockService.getBlockedUsers(userId, page, limit);
    res.json(result);
  }));

  // Check if a user is blocked
  router.get('/blocked/:userId', asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const targetId = req.params.userId;

    const relationship = await blockService.getBlockRelationship(userId, targetId);
    res.json(relationship);
  }));

  return router;
}