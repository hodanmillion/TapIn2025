export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface UpdateProfileDto {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
  dateOfBirth?: Date;
  isPrivate?: boolean;
}

export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  cursor?: string;
}