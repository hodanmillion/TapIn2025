import api from './api';

export interface HexCell {
  h3_index: string;
  resolution: number;
  center: { lat: number; lng: number };
  display_name: string;
  locality?: string;
  active_users: number;
  boundary: [number, number][];
}

export interface NeighborHex {
  h3_index: string;
  name: string;
  active_users: number;
  distance_km: number;
  direction: string;
}

export interface HexJoinResponse {
  hex_cell: HexCell;
  neighbors: NeighborHex[];
  your_position: { lat: number; lng: number };
}

export interface HexResolution {
  level: number;
  name: string;
  approximate_area_km2: number;
  description: string;
}

export interface HexResolutionsResponse {
  resolutions: HexResolution[];
  default: number;
}

class HexService {
  async joinHex(lat: number, lng: number, resolution: number = 8): Promise<HexJoinResponse> {
    const response = await api.post('/api/v1/hex/join', undefined, {
      params: { lat, lng, resolution },
    });
    return response.data;
  }
  
  async getHexInfo(h3Index: string): Promise<HexCell> {
    const response = await api.get(`/api/v1/hex/cell/${h3Index}`);
    return response.data;
  }
  
  async getNeighbors(h3Index: string, rings: number = 1): Promise<{ neighbors: NeighborHex[] }> {
    const response = await api.get(`/api/v1/hex/neighbors/${h3Index}`, {
      params: { rings },
    });
    return response.data;
  }
  
  async getResolutions(): Promise<HexResolutionsResponse> {
    const response = await api.get('/api/v1/hex/resolutions');
    return response.data;
  }
  
  async cleanupInactiveUsers(timeoutMinutes: number = 30): Promise<{ status: string }> {
    const response = await api.post('/api/v1/hex/cleanup', undefined, {
      params: { timeout_minutes: timeoutMinutes },
    });
    return response.data;
  }
}

export const hexService = new HexService();