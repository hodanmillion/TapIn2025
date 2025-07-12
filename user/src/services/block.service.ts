import { PrismaClient } from '@prisma/client';
import { UserNotFoundError, ValidationError } from '../errors';

export class BlockService {
  constructor(private prisma: PrismaClient) {}

  async blockUser(blockerId: string, blockedId: string, reason?: string) {
    // Validate users exist
    const [blocker, blocked] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: blockerId } }),
      this.prisma.user.findUnique({ where: { id: blockedId } })
    ]);

    if (!blocker || !blocked) {
      throw new UserNotFoundError('User not found');
    }

    if (blockerId === blockedId) {
      throw new ValidationError('Cannot block yourself');
    }

    // Check if already blocked
    const existingBlock = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId
        }
      }
    });

    if (existingBlock) {
      return existingBlock;
    }

    // Create block and unfollow in a transaction
    const block = await this.prisma.$transaction(async (tx) => {
      // Remove any existing follows in both directions
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: blockedId },
            { followerId: blockedId, followingId: blockerId }
          ]
        }
      });

      // Update follower counts
      await tx.user.update({
        where: { id: blockerId },
        data: { followingCount: { decrement: 1 } },
      }).catch(() => {}); // Ignore if no follow existed

      await tx.user.update({
        where: { id: blockedId },
        data: { followersCount: { decrement: 1 } },
      }).catch(() => {}); // Ignore if no follow existed

      // Create the block
      return await tx.block.create({
        data: {
          blockerId,
          blockedId,
          reason
        },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      });
    });

    return block;
  }

  async unblockUser(blockerId: string, blockedId: string) {
    const result = await this.prisma.block.deleteMany({
      where: {
        blockerId,
        blockedId
      }
    });

    if (result.count === 0) {
      throw new ValidationError('User is not blocked');
    }

    return { success: true };
  }

  async getBlockedUsers(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [blocks, total] = await Promise.all([
      this.prisma.block.findMany({
        where: { blockerId: userId },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.block.count({
        where: { blockerId: userId }
      })
    ]);

    return {
      blocks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async isBlocked(userId: string, targetId: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId }
        ]
      }
    });

    return !!block;
  }

  async getBlockRelationship(userId: string, targetId: string) {
    const [userBlocked, blockedByUser] = await Promise.all([
      this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: targetId
          }
        }
      }),
      this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: targetId,
            blockedId: userId
          }
        }
      })
    ]);

    return {
      blocking: !!userBlocked,
      blockedBy: !!blockedByUser
    };
  }
}

export const blockService = new BlockService(new PrismaClient());