import api from './api';
import { Location, NearbyResponse } from '@/types';

export const locationService = {
  async searchAddresses(query: string, limit = 5): Promise<Location[]> {
    const { data } = await api.post<Location[]>('/api/v1/addresses/search', {
      query,
      limit,
    });
    return data || [];
  },

  async getOrCreateLocation(params: {
    place_id?: string;
    address?: string;
    coordinates?: { latitude: number; longitude: number };
  }): Promise<Location> {
    const { data } = await api.post<Location>('/api/v1/addresses/detail', params);
    return data;
  },

  async findNearbyLocations(
    coordinates: { latitude: number; longitude: number },
    radiusKm: number,
    limit: number
  ): Promise<NearbyResponse[]> {
    const { data } = await api.get<{ addresses: NearbyResponse[] }>('/api/v1/spatial/nearby', {
      params: {
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        radius_km: radiusKm,
        limit,
      },
    });
    return data.addresses || [];
  },

  async getLocationById(locationId: string): Promise<Location> {
    const { data } = await api.get<Location>(`/api/v1/addresses/${locationId}`);
    return data;
  },

  async getLocationDetails(placeId: string): Promise<Location> {
    const { data } = await api.get<Location>(`/api/v1/addresses/place/${placeId}`);
    return data;
  },
};