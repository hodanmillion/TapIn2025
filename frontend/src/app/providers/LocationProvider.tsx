import { createContext, useContext, useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

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

  const requestLocation = useCallback(async () => {
    console.log('LocationProvider: requestLocation called');
    
    // For development on localhost, always use mock location
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('LocationProvider: Using mock location for localhost development');
      setIsLoadingLocation(true);
      setTimeout(() => {
        console.log('LocationProvider: Mock location set', MOCK_LOCATION.coords);
        setCurrentLocation(MOCK_LOCATION);
        setIsLoadingLocation(false);
      }, 1000);
      return;
    }
    
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

    setIsLoadingLocation(true);
    setLocationError(null); // Clear any previous errors
    
    // Use Capacitor Geolocation for mobile, browser API for web
    if (Capacitor.isNativePlatform()) {
      console.log('LocationProvider: Using Capacitor Geolocation...');
      
      try {
        // Request permissions first
        const permissions = await Geolocation.requestPermissions();
        console.log('LocationProvider: Permissions:', permissions);
        
        if (permissions.location === 'denied') {
          setLocationError('Location permission denied. Please enable location access in your device settings.');
          setIsLoadingLocation(false);
          return;
        }
        
        // Get current position
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000
        });
        
        console.log('LocationProvider: Capacitor success!', position);
        
        // Convert Capacitor position to browser GeolocationPosition format
        const browserPosition = {
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy || null,
            heading: position.coords.heading,
            speed: position.coords.speed,
            toJSON: () => ({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy || null,
              heading: position.coords.heading,
              speed: position.coords.speed
            })
          },
          timestamp: position.timestamp
        } as GeolocationPosition;
        
        setCurrentLocation(browserPosition);
        setIsLoadingLocation(false);
      } catch (error: any) {
        console.error('LocationProvider: Capacitor error', error);
        setLocationError(error.message || 'Failed to get location');
        setIsLoadingLocation(false);
      }
    } else {
      // Use browser geolocation for web
      console.log('LocationProvider: Using browser geolocation...');
      
      if (!navigator.geolocation) {
        console.error('LocationProvider: Geolocation not supported');
        setLocationError('Geolocation is not supported');
        setIsLoadingLocation(false);
        return;
      }
      
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
    }
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