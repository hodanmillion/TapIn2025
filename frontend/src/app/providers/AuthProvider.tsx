import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';
import api from '@/services/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Set token in axios defaults
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      authService.getMe().then(setUser).catch(() => {
        setToken(null);
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    localStorage.setItem('token', response.access_token);
    setToken(response.access_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${response.access_token}`;
    
    // If user is not included in login response, fetch it
    if (response.user) {
      setUser(response.user);
    } else {
      const user = await authService.getMe();
      setUser(user);
    }
  };

  const register = async (email: string, username: string, password: string) => {
    await authService.register(email, username, password);
    await login(email, password);
  };

  const logout = async () => {
    await authService.logout();
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      isLoading,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};