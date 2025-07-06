import api from './api';
import { User, LoginResponse } from '@/types';

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post('/api/v1/auth/login', { email, password });
    return data;
  },

  async register(email: string, username: string, password: string): Promise<void> {
    await api.post('/api/v1/auth/register', { email, username, password });
  },

  async logout(): Promise<void> {
    await api.post('/api/v1/auth/logout');
  },

  async getMe(): Promise<User> {
    const { data } = await api.get('/api/v1/users/me');
    return data;
  },

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const { data } = await api.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
    return data;
  },

  async verifyEmail(token: string): Promise<void> {
    await api.post('/api/v1/auth/verify-email', { token });
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/api/v1/auth/forgot-password', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await api.post('/api/v1/auth/reset-password', { token, password });
  },
};