import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { StartConversationButton } from '@/features/dm/components/StartConversationButton';
import { useState, useEffect } from 'react';
import { userService } from '@/services/user.service';
import toast from 'react-hot-toast';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, token } = useAuth();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const isOwnProfile = user?.username === username;

  useEffect(() => {
    const loadProfile = async () => {
      if (!username || !token) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch the actual user profile
        const response = await fetch(`/api/v1/profile/${username}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setProfileUser(data);
          setIsFollowing(data.isFollowing || false);
        } else if (response.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load profile');
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [username, token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.history.back()} 
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayUser = profileUser || user;
  const displayName = displayUser?.displayName || displayUser?.username || username;

  const handleFollowToggle = async () => {
    if (!profileUser) return;
    
    try {
      setIsFollowLoading(true);
      if (isFollowing) {
        await userService.unfollowUser(profileUser.id);
        setIsFollowing(false);
        setProfileUser({
          ...profileUser,
          _count: {
            ...profileUser._count,
            followers: Math.max(0, (profileUser._count?.followers || 0) - 1)
          }
        });
        toast.success('Unfollowed successfully');
      } else {
        await userService.followUser(profileUser.id);
        setIsFollowing(true);
        setProfileUser({
          ...profileUser,
          _count: {
            ...profileUser._count,
            followers: (profileUser._count?.followers || 0) + 1
          }
        });
        toast.success('Followed successfully');
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      toast.error(isFollowing ? 'Failed to unfollow' : 'Failed to follow');
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-4">
            {displayUser?.avatarUrl ? (
              <img 
                src={displayUser.avatarUrl} 
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-2xl font-semibold text-gray-600">
                  {displayName?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <p className="text-gray-600">@{displayUser?.username || username}</p>
              {displayUser?.bio && (
                <p className="text-gray-700 mt-2">{displayUser.bio}</p>
              )}
              {displayUser?.location && (
                <p className="text-gray-600 text-sm mt-1">📍 {displayUser.location}</p>
              )}
            </div>
          </div>

          {isOwnProfile && user && (
            <div className="mt-6">
              <p className="text-gray-700">Email: {user.email}</p>
              <p className="text-gray-700">
                Member since: {displayUser?.createdAt ? new Date(displayUser.createdAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          )}

          {displayUser && (
            <div className="mt-6 border-t pt-4">
              <div className="flex space-x-6 text-sm">
                <div>
                  <span className="font-semibold">{displayUser._count?.followers || 0}</span>
                  <span className="text-gray-600 ml-1">followers</span>
                </div>
                <div>
                  <span className="font-semibold">{displayUser._count?.following || 0}</span>
                  <span className="text-gray-600 ml-1">following</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center space-x-3">
            {isOwnProfile ? (
              <Link 
                to="/settings"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 inline-block text-center"
              >
                Edit Profile
              </Link>
            ) : (
              profileUser && (
                <>
                  <button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`px-4 py-2 rounded font-medium transition-colors ${
                      isFollowing 
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isFollowLoading ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        {isFollowing ? 'Unfollowing...' : 'Following...'}
                      </span>
                    ) : (
                      isFollowing ? 'Unfollow' : 'Follow'
                    )}
                  </button>
                  <StartConversationButton 
                    userId={profileUser.id} 
                    username={profileUser.username} 
                  />
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}