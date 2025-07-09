import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLocation } from '@/app/providers/LocationProvider';
import { useEffect, useRef } from 'react';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requestLocation, currentLocation, locationError, isLoadingLocation } = useLocation();
  const hasRequestedLocation = useRef(false);

  // Navigate to chat when location becomes available after request
  useEffect(() => {
    console.log('HomePage useEffect:', {
      hasCurrentLocation: !!currentLocation,
      hasRequestedLocation: hasRequestedLocation.current,
      isLoadingLocation
    });
    
    if (currentLocation && hasRequestedLocation.current && !isLoadingLocation) {
      const lat = currentLocation.coords.latitude;
      const lon = currentLocation.coords.longitude;
      const locationId = `${lat}_${lon}`;
      console.log('HomePage: Auto-navigating to:', `/location/${locationId}`);
      navigate(`/location/${locationId}`);
      hasRequestedLocation.current = false;
    }
  }, [currentLocation, isLoadingLocation, navigate]);

  const handleFindNearby = () => {
    console.log('Find Nearby Chats clicked');
    console.log('Current location:', currentLocation);
    
    if (currentLocation) {
      // Navigate directly to chat room with coordinates
      const lat = currentLocation.coords.latitude;
      const lon = currentLocation.coords.longitude;
      const locationId = `${lat}_${lon}`;
      console.log('Navigating to:', `/location/${locationId}`);
      navigate(`/location/${locationId}`);
    } else {
      console.log('No location yet, requesting...');
      hasRequestedLocation.current = true;
      requestLocation();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Welcome to Location Chat
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Connect with people at your location. Share experiences, ask questions, and build local communities.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg text-gray-700">Hello, {user?.username}!</p>
            </div>

            <button
              onClick={handleFindNearby}
              disabled={isLoadingLocation}
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 md:py-4 md:text-lg md:px-10 disabled:opacity-50"
            >
              {isLoadingLocation ? 'Getting location...' : 'Find Nearby Chats'}
            </button>

            {locationError && (
              <p className="text-red-500 text-sm text-center">{locationError}</p>
            )}

            <button
              onClick={() => navigate('/search')}
              className="w-full flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
            >
              Search by Address
            </button>
          </div>
        </div>

        {currentLocation && (
          <div className="mt-8 text-center text-sm text-gray-500">
            Location access granted. Click "Find Nearby Chats" to discover local conversations.
          </div>
        )}
      </div>
    </div>
  );
}