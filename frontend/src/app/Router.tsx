import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { MainLayout } from '@/shared/components/layout/MainLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { HomePage } from '@/features/home/pages/HomePage';
import { ChatPage } from '@/features/chat/pages/ChatPage';
import { ProfilePage } from '@/features/user/pages/ProfilePage';
import { SettingsPage } from '@/features/user/pages/SettingsPage';
import { LocationSearchPage } from '@/features/location/pages/LocationSearchPage';
import { HexChatPage } from '@/features/hex/pages/HexChatPage';
import { MessagesPage } from '@/features/dm/pages/MessagesPage';
import { DebugPage } from '@/features/auth/pages/DebugPage';
import { NetworkTestPage } from '@/features/auth/pages/NetworkTestPage';

export function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('Router render:', { isAuthenticated, isLoading });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      {!isAuthenticated ? (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/network-test" element={<NetworkTestPage />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </>
      ) : (
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/location/:locationId" element={<ChatPage />} />
          <Route path="/hex/:h3Index" element={<HexChatPage />} />
          <Route path="/search" element={<LocationSearchPage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<MessagesPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      )}
    </Routes>
  );
}