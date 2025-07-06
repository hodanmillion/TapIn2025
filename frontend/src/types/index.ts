export interface User {
  id: string;
  email: string;
  username: string;
  email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  // Extended profile fields from user service
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isVerified?: boolean;
  followersCount?: number;
  followingCount?: number;
}

export interface Location {
  id: string;
  place_id: string;
  address_string: string;
  normalized_address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  components: {
    street_number?: string;
    street_name?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
  };
  h3_index?: string;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  location_id: string;
  active_users: number;
  last_message_at: string;
  created_at: string;
  settings: {
    max_users: number;
    rate_limit: number;
  };
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  content: string;
  timestamp: string;
  edited_at?: string;
  deleted: boolean;
  reactions?: Reaction[];
}

export interface Reaction {
  user_id: string;
  emoji: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user?: User;
}

export interface SearchAddressResponse {
  locations: Location[];
}

export interface NearbyResponse {
  location: Location;
  active_users: number;
  last_activity?: string;
  distance_meters?: number;
}

export interface UpdateProfileData {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
  dateOfBirth?: string;
  isPrivate?: boolean;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface GeolocationState {
  coordinates: GeolocationCoordinates | null;
  error: string | null;
  isLoading: boolean;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}