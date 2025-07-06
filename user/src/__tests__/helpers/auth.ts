import jwt from 'jsonwebtoken';

export function generateTestToken(userId: string = 'test-user-id'): string {
  const payload = {
    user_id: userId,
    email: 'test@example.com',
    username: 'testuser',
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-super-secret-jwt-key', {
    expiresIn: '1h',
  });
}

export function getAuthHeader(token?: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token || generateTestToken()}`,
  };
}