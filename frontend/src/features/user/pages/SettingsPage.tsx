import { useAuth } from '@/features/auth/hooks/useAuth';
import { userService } from '@/services/user.service';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    location: '',
    website: '',
    isPrivate: false,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await userService.getMyProfile();
      setFormData({
        displayName: data.displayName || '',
        bio: data.bio || '',
        location: data.location || '',
        website: data.website || '',
        isPrivate: data.isPrivate || false,
      });
      setAvatarUrl(data.avatarUrl || null);
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await userService.updateProfile(formData);
      toast.success('Profile updated successfully');
      await loadProfile(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const { avatarUrl: newAvatarUrl } = await userService.uploadAvatar(file);
      setAvatarUrl(newAvatarUrl);
      toast.success('Avatar uploaded successfully');
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow">
            {/* Avatar Section */}
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-semibold text-gray-600">
                        {user?.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="avatar-upload" className="cursor-pointer">
                    <span className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 inline-block">
                      Change Avatar
                    </span>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={isUploadingAvatar}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">JPG, PNG or WebP. Max 10MB.</p>
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your display name"
                  />
                </div>
                
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={3}
                    value={formData.bio}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Tell us about yourself..."
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-gray-500">{formData.bio.length}/500 characters</p>
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your location"
                  />
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                    Website
                  </label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://your-website.com"
                  />
                </div>
              </div>
            </div>

            {/* Account Information (Read-only) */}
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold mb-4">Account Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <p className="mt-1 text-sm text-gray-900">@{user?.username}</p>
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Privacy Settings</h2>
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isPrivate"
                    checked={formData.isPrivate}
                    onChange={handleInputChange}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">Private Profile</span>
                    <span className="text-xs text-gray-500">Only followers can see your profile details</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center space-x-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
            
            <button
              type="button"
              onClick={loadProfile}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}