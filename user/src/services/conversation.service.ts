import { prisma } from './index';
import { ConflictError, ForbiddenError, UserNotFoundError } from '../errors';
import { blockService } from './block.service';

export class ConversationService {
  async createConversation(currentUserId: string, otherUserId: string) {
    // Check if users exist
    const [currentUser, otherUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: currentUserId } }),
      prisma.user.findUnique({ where: { id: otherUserId } })
    ]);

    if (!currentUser || !otherUser) {
      throw new UserNotFoundError('One or both users not found');
    }

    // Check if users are blocked
    const isBlocked = await blockService.isBlocked(currentUserId, otherUserId);
    if (isBlocked) {
      throw new ForbiddenError('Cannot create conversation with blocked user');
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: {
              in: [currentUserId, otherUserId]
            }
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (existingConversation && existingConversation.participants.length === 2) {
      return existingConversation;
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: currentUserId },
            { userId: otherUserId }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    return conversation;
  }

  async getConversations(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: userId,
            leftAt: null
          }
        }
      },
      include: {
        participants: {
          where: {
            leftAt: null
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isVerified: true
              }
            }
          }
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      },
      skip,
      take: limit
    });

    const total = await prisma.conversation.count({
      where: {
        participants: {
          some: {
            userId: userId,
            leftAt: null
          }
        }
      }
    });

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: userId,
            leftAt: null
          }
        }
      },
      include: {
        participants: {
          where: {
            leftAt: null
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isVerified: true,
                bio: true
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      throw new UserNotFoundError('Conversation not found or access denied');
    }

    return conversation;
  }

  async markAsRead(conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null
      }
    });

    if (!participant) {
      throw new ForbiddenError('Not a participant in this conversation');
    }

    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { hasReadLatest: true }
    });

    return { success: true };
  }

  async muteConversation(conversationId: string, userId: string, mutedUntil: Date | null) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null
      }
    });

    if (!participant) {
      throw new ForbiddenError('Not a participant in this conversation');
    }

    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { mutedUntil }
    });

    return { success: true };
  }

  async leaveConversation(conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null
      }
    });

    if (!participant) {
      throw new ForbiddenError('Not a participant in this conversation');
    }

    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() }
    });

    return { success: true };
  }

  async updateLastMessage(conversationId: string, messageText: string, senderId: string) {
    // This will be called by the chat service when a new message is sent
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessageText: messageText,
        lastMessageBy: senderId
      }
    });

    // Mark all other participants as unread
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: { not: senderId },
        leftAt: null
      },
      data: { hasReadLatest: false }
    });
  }
}

export const conversationService = new ConversationService();