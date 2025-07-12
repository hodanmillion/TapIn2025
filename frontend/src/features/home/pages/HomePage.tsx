import { useAuth } from '@/features/auth/hooks/useAuth';
import { useHexChat } from '@/features/hex/hooks/useHexChat';

export function HomePage() {
  const { user } = useAuth();
  const { joinNearbyHex, loading } = useHexChat();
  
  const handleTapIn = () => {
    console.log('TAP IN button clicked');
    // Automatically use neighborhood resolution (8) for ~700m radius
    joinNearbyHex(8);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
      <div className="text-center">
        {/* Logo/Title */}
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          Tap In
        </h1>
        <p className="text-xl text-gray-600 mb-12 max-w-md mx-auto">
          Connect with your neighborhood
        </p>

        {/* Main Tap In Button */}
        <button
          onClick={handleTapIn}
          disabled={loading}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600 to-primary-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          <div className="relative flex items-center justify-center w-48 h-48 bg-primary-600 hover:bg-primary-700 text-white rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (
              <div className="flex flex-col items-center">
                <svg className="animate-spin h-12 w-12 text-white mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Locating...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-4xl font-bold mb-1">TAP IN</span>
                <span className="text-sm opacity-90">to your neighborhood</span>
              </div>
            )}
          </div>
        </button>

        {/* User greeting */}
        <p className="mt-12 text-gray-600">
          Welcome back, <span className="font-semibold">{user?.username}</span>
        </p>
      </div>
    </div>
  );
}