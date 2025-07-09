import { useState, useEffect, useCallback } from 'react';

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [coordinates, setCoordinates] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = 60000,
    watch = false
  } = options;

  useEffect(() => {
    setIsSupported('geolocation' in navigator);
  }, []);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setCoordinates({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    });
    setError(null);
    setIsLoading(false);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    const errorMessage = {
      [err.PERMISSION_DENIED]: 'Location access denied by user',
      [err.POSITION_UNAVAILABLE]: 'Location information unavailable',
      [err.TIMEOUT]: 'Location request timed out',
    }[err.code] || 'Unknown geolocation error';

    setError({
      code: err.code,
      message: errorMessage,
    });
    setIsLoading(false);
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!isSupported) {
      setError({
        code: -1,
        message: 'Geolocation is not supported by this browser',
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [isSupported, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  useEffect(() => {
    if (!watch || !isSupported) return;

    let watchId: number;

    const startWatching = () => {
      setIsLoading(true);
      setError(null);

      watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      );
    };

    startWatching();

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watch, isSupported, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  return {
    coordinates,
    error,
    isLoading,
    isSupported,
    getCurrentPosition,
  };
}