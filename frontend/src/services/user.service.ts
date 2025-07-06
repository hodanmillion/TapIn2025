import api from './api';
import { User, UpdateProfileData } from '@/types';

export const userService = {
  async getProfile(username: string): Promise<User> {
    const { data } = await api.get<User>(`/api/v1/profile/${username}`);
    return data;
  },

  async getMyProfile(): Promise<User> {
    const { data } = await api.get<User>('/api/v1/profile/me');
    return data;
  },

  async updateProfile(data: UpdateProfileData): Promise<User> {
    const { data: user } = await api.put<User>('/api/v1/profile/me', data);
    return user;
  },

  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const { data } = await api.post<{ avatarUrl: string }>(
      '/api/v1/upload/avatar',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return data;
  },

  async followUser(userId: string): Promise<void> {
    await api.post(`/api/v1/social/follow/${userId}`);
  },

  async unfollowUser(userId: string): Promise<void> {
    await api.delete(`/api/v1/social/unfollow/${userId}`);
  },

  async searchUsers(query: string, page = 1, limit = 20): Promise<{
    users: User[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const { data } = await api.get('/api/v1/search/users', {
      params: { q: query, page, limit },
    });
    return data;
  },

  async updateSettings(settings: any): Promise<void> {
    await api.put('/api/v1/settings', settings);
  },

  async getSettings(): Promise<any> {
    const { data } = await api.get('/api/v1/settings');
    return data;
  },
};