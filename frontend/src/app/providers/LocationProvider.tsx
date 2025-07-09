import { createContext, useContext, useState, useCallback } from 'react';

interface LocationContextType {
  currentLocation: GeolocationPosition | null;
  locationError: string | null;
  isLoadingLocation: boolean;
  requestLocation: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Mock location for development/testing
const MOCK_LOCATION = {
  coords: {
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 100,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp: Date.now()
} as GeolocationPosition;

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const requestLocation = useCallback(() => {
    console.log('LocationProvider: requestLocation called');
    
    // Check for mock location in development
    if (import.meta.env.DEV && window.location.search.includes('mockLocation=true')) {
      console.log('LocationProvider: Using mock location for development');
      setIsLoadingLocation(true);
      setTimeout(() => {
        console.log('LocationProvider: Mock location set', MOCK_LOCATION.coords);
        setCurrentLocation(MOCK_LOCATION);
        setIsLoadingLocation(false);
      }, 1000);
      return;
    }
    
    if (!navigator.geolocation) {
      console.error('LocationProvider: Geolocation not supported');
      setLocationError('Geolocation is not supported');
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null); // Clear any previous errors
    
    console.log('LocationProvider: Calling getCurrentPosition...');
    
    // Try with less strict options first
    const options: PositionOptions = {
      enableHighAccuracy: false, // Start with low accuracy
      timeout: 10000, // 10 seconds
      maximumAge: 300000 // Accept positions up to 5 minutes old
    };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('LocationProvider: Success!', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setCurrentLocation(position);
        setIsLoadingLocation(false);
      },
      (error) => {
        console.error('LocationProvider: Error', {
          code: error.code,
          message: error.message
        });
        
        // If first attempt fails, try one more time with high accuracy
        if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
          console.log('LocationProvider: Retrying with high accuracy...');
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('LocationProvider: Success on retry!', position.coords);
              setCurrentLocation(position);
              setIsLoadingLocation(false);
            },
            (finalError) => {
              console.error('LocationProvider: Final error', finalError);
              
              // Provide more user-friendly error messages
              let errorMessage = finalError.message;
              switch (finalError.code) {
                case finalError.PERMISSION_DENIED:
                  errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
                  break;
                case finalError.POSITION_UNAVAILABLE:
                  errorMessage = 'Location information is unavailable. Please check your device settings.';
                  break;
                case finalError.TIMEOUT:
                  errorMessage = 'Location request timed out. Please try again.';
                  break;
              }
              
              setLocationError(errorMessage);
              setIsLoadingLocation(false);
            },
            { 
              enableHighAccuracy: true,
              timeout: 20000, // 20 seconds for retry
              maximumAge: 0
            }
          );
        } else {
          // Provide user-friendly error messages
          let errorMessage = error.message;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
          }
          
          setLocationError(errorMessage);
          setIsLoadingLocation(false);
        }
      },
      options
    );
  }, []);

  return (
    <LocationContext.Provider value={{
      currentLocation,
      locationError,
      isLoadingLocation,
      requestLocation,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};