import api from './api';
import { ChatRoom, Message } from '@/types';

export const chatService = {
  async getRoomInfo(locationId: string): Promise<ChatRoom> {
    const { data } = await api.get<ChatRoom>(`/api/rooms/${locationId}`);
    return data;
  },

  async joinRoom(locationId: string): Promise<{ success: boolean; active_users: number }> {
    const { data } = await api.post(`/api/rooms/${locationId}/join`);
    return data;
  },

  async getMessages(
    locationId: string,
    limit = 50,
    before?: string
  ): Promise<Message[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);

    const { data } = await api.get<Message[]>(
      `/api/messages/${locationId}?${params}`
    );
    return data;
  },

  async sendMessage(locationId: string, content: string): Promise<Message> {
    const { data } = await api.post<Message>('/api/messages', {
      location_id: locationId,
      content,
    });
    return data;
  },
};