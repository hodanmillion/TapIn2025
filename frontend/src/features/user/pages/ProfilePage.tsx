import { useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();

  const isOwnProfile = user?.username === username;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-2xl font-semibold text-gray-600">
                {username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">{username}</h1>
              <p className="text-gray-600">@{username}</p>
            </div>
          </div>

          {isOwnProfile && (
            <div className="mt-6">
              <p className="text-gray-700">Email: {user?.email}</p>
              <p className="text-gray-700">
                Member since: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          )}

          {isOwnProfile && (
            <div className="mt-6">
              <button className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600">
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}