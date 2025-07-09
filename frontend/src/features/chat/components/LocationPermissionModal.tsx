import { useState, useEffect } from 'react';
import { useGeolocation } from '@/shared/hooks/useGeolocation';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationGranted: (coordinates: { latitude: number; longitude: number }) => void;
}

export function LocationPermissionModal({ 
  isOpen, 
  onClose, 
  onLocationGranted 
}: LocationPermissionModalProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const { coordinates, getCurrentPosition, error, isSupported } = useGeolocation();

  const handleRequestLocation = async () => {
    if (!isSupported) {
      return;
    }

    setIsRequesting(true);
    
    try {
      await getCurrentPosition();
      // The hook will handle the success case
    } catch (err) {
      // Error is handled by the hook
    } finally {
      setIsRequesting(false);
    }
  };

  // Handle successful location
  useEffect(() => {
    if (coordinates && !error) {
      onLocationGranted(coordinates);
      onClose();
    }
  }, [coordinates, error, onLocationGranted, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="location-permission-modal" role="dialog">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="text-center">
          <div className="mb-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Enable Location Access
            </h3>
            <p className="text-gray-600 mb-6">
              To find and join local chat rooms near you, we need access to your location. 
              Your location is only used to find nearby chats and is not stored or shared.
            </p>
          </div>

          {!isSupported && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-sm">
                Your browser doesn't support location services. 
                Please use a modern browser to access location-based features.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-sm">{error.message}</p>
              {error.code === 1 && (
                <p className="text-red-600 text-xs mt-2">
                  Please enable location permissions in your browser settings and try again.
                </p>
              )}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRequestLocation}
              disabled={!isSupported || isRequesting}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="allow-location-button"
            >
              {isRequesting ? 'Getting Location...' : 'Allow Location'}
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p>
              🔒 Your privacy is important. Location data is only used to find nearby chats 
              and is never stored on our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}