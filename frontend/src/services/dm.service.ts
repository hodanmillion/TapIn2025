import api from './api';
import { Conversation, CreateConversationRequest, DirectMessage } from '../types';

export const dmService = {
  // Conversation management
  async getConversations(): Promise<Conversation[]> {
    const response = await api.get(`/api/v1/conversations`);
    // The API returns { conversations: [...], pagination: {...} }
    return response.data.conversations || [];
  },

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await api.get(`/api/v1/conversations/${conversationId}`);
    return response.data;
  },

  async createConversation(data: CreateConversationRequest): Promise<Conversation> {
    const response = await api.post(`/api/v1/conversations`, data);
    return response.data;
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/api/v1/conversations/${conversationId}`);
  },

  // Message history
  async getMessages(conversationId: string, limit?: number, before?: string): Promise<DirectMessage[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);
    
    const response = await api.get(`/api/dm/${conversationId}/messages?${params}`);
    return response.data.messages;
  },

  // User blocking
  async blockUser(userId: string, reason?: string): Promise<void> {
    await api.post(`/api/v1/users/${userId}/block`, { reason });
  },

  async unblockUser(userId: string): Promise<void> {
    await api.delete(`/api/v1/users/${userId}/block`);
  },

  async getBlockedUsers(): Promise<any[]> {
    const response = await api.get(`/api/v1/users/blocked`);
    return response.data;
  },

  // WebSocket URL for DM chat
  getDMWebSocketUrl(conversationId: string): string {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = import.meta.env.DEV ? '3001' : window.location.port;
    return `${wsProtocol}//${host}:${port}/ws/dm/${conversationId}`;
  }
};