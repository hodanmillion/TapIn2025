import { hexService } from '../hex.service';
import api from '../api';

jest.mock('../api', () => ({
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe('HexService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('joinHex', () => {
    it('should join hex successfully', async () => {
      const mockResponse = {
        data: {
          hex_cell: {
            h3_index: '882a1072cffffff',
            resolution: 8,
            center: { lat: 40.7589, lng: -73.9851 },
            display_name: 'Test Neighborhood',
            active_users: 5,
            boundary: [[40.759, -73.985]],
          },
          neighbors: [
            {
              h3_index: 'neighbor1',
              name: 'North Area',
              active_users: 3,
              distance_km: 0.5,
              direction: 'north',
            },
          ],
          your_position: { lat: 40.7589, lng: -73.9851 },
        },
      };
      
      (api.post as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await hexService.joinHex(40.7589, -73.9851, 8);
      
      expect(api.post).toHaveBeenCalledWith('/api/v1/hex/join', undefined, {
        params: {
          lat: 40.7589,
          lng: -73.9851,
          resolution: 8,
        },
      });
      
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should use default resolution when not provided', async () => {
      const mockResponse = { data: { hex_cell: {}, neighbors: [], your_position: {} } };
      (api.post as jest.Mock).mockResolvedValue(mockResponse);
      
      await hexService.joinHex(40.7589, -73.9851);
      
      expect(api.post).toHaveBeenCalledWith('/api/v1/hex/join', undefined, {
        params: {
          lat: 40.7589,
          lng: -73.9851,
          resolution: 8, // Default resolution
        },
      });
    });
    
    it('should handle API error', async () => {
      const error = new Error('API Error');
      (api.post as jest.Mock).mockRejectedValue(error);
      
      await expect(hexService.joinHex(40.7589, -73.9851)).rejects.toThrow('API Error');
    });
  });
  
  describe('getHexInfo', () => {
    it('should get hex info successfully', async () => {
      const mockResponse = {
        data: {
          h3_index: '882a1072cffffff',
          resolution: 8,
          center: { lat: 40.7589, lng: -73.9851 },
          display_name: 'Test Neighborhood',
          active_users: 5,
          boundary: [[40.759, -73.985]],
        },
      };
      
      (api.get as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await hexService.getHexInfo('882a1072cffffff');
      
      expect(api.get).toHaveBeenCalledWith('/api/v1/hex/cell/882a1072cffffff');
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should handle hex not found error', async () => {
      const error = new Error('Hex cell not found');
      (api.get as jest.Mock).mockRejectedValue(error);
      
      await expect(hexService.getHexInfo('nonexistent')).rejects.toThrow('Hex cell not found');
    });
  });
  
  describe('getNeighbors', () => {
    it('should get neighbors successfully', async () => {
      const mockResponse = {
        data: {
          neighbors: [
            {
              h3_index: 'neighbor1',
              name: 'North Area',
              active_users: 3,
              distance_km: 0.5,
              direction: 'north',
            },
            {
              h3_index: 'neighbor2',
              name: 'South Area',
              active_users: 2,
              distance_km: 0.7,
              direction: 'south',
            },
          ],
        },
      };
      
      (api.get as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await hexService.getNeighbors('882a1072cffffff');
      
      expect(api.get).toHaveBeenCalledWith('/api/v1/hex/neighbors/882a1072cffffff', {
        params: { rings: 1 },
      });
      
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should use custom rings parameter', async () => {
      const mockResponse = { data: { neighbors: [] } };
      (api.get as jest.Mock).mockResolvedValue(mockResponse);
      
      await hexService.getNeighbors('882a1072cffffff', 2);
      
      expect(api.get).toHaveBeenCalledWith('/api/v1/hex/neighbors/882a1072cffffff', {
        params: { rings: 2 },
      });
    });
  });
  
  describe('getResolutions', () => {
    it('should get available resolutions', async () => {
      const mockResponse = {
        data: {
          resolutions: [
            {
              level: 6,
              name: 'City',
              approximate_area_km2: 100,
              description: 'City-wide chat rooms',
            },
            {
              level: 8,
              name: 'Neighborhood',
              approximate_area_km2: 0.7,
              description: 'Standard neighborhood chat (default)',
            },
          ],
          default: 8,
        },
      };
      
      (api.get as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await hexService.getResolutions();
      
      expect(api.get).toHaveBeenCalledWith('/api/v1/hex/resolutions');
      expect(result).toEqual(mockResponse.data);
    });
  });
});


// Mock hex service implementation
class MockHexService {
  async joinHex(lat: number, lng: number, resolution: number = 8) {
    const response = await api.post('/api/v1/hex/join', undefined, {
      params: { lat, lng, resolution },
    });
    return response.data;
  }
  
  async getHexInfo(h3Index: string) {
    const response = await api.get(`/api/v1/hex/cell/${h3Index}`);
    return response.data;
  }
  
  async getNeighbors(h3Index: string, rings: number = 1) {
    const response = await api.get(`/api/v1/hex/neighbors/${h3Index}`, {
      params: { rings },
    });
    return response.data;
  }
  
  async getResolutions() {
    const response = await api.get('/api/v1/hex/resolutions');
    return response.data;
  }
}

describe('HexService Integration', () => {
  const service = new MockHexService();
  
  it('should handle complete flow', async () => {
    // Mock successful responses
    const joinResponse = {
      data: {
        hex_cell: {
          h3_index: '882a1072cffffff',
          resolution: 8,
          center: { lat: 40.7589, lng: -73.9851 },
          display_name: 'Test Neighborhood',
          active_users: 5,
          boundary: [[40.759, -73.985]],
        },
        neighbors: [
          {
            h3_index: 'neighbor1',
            name: 'North Area',
            active_users: 3,
            distance_km: 0.5,
            direction: 'north',
          },
        ],
        your_position: { lat: 40.7589, lng: -73.9851 },
      },
    };
    
    const hexInfoResponse = {
      data: {
        h3_index: '882a1072cffffff',
        resolution: 8,
        center: { lat: 40.7589, lng: -73.9851 },
        display_name: 'Test Neighborhood',
        active_users: 5,
        boundary: [[40.759, -73.985]],
      },
    };
    
    const neighborsResponse = {
      data: {
        neighbors: [
          {
            h3_index: 'neighbor1',
            name: 'North Area',
            active_users: 3,
            distance_km: 0.5,
            direction: 'north',
          },
        ],
      },
    };
    
    (api.post as jest.Mock).mockResolvedValue(joinResponse);
    (api.get as jest.Mock)
      .mockResolvedValueOnce(hexInfoResponse)
      .mockResolvedValueOnce(neighborsResponse);
    
    // Join hex
    const joinResult = await service.joinHex(40.7589, -73.9851, 8);
    expect(joinResult.hex_cell.h3_index).toBe('882a1072cffffff');
    expect(joinResult.neighbors).toHaveLength(1);
    
    // Get hex info
    const hexInfo = await service.getHexInfo('882a1072cffffff');
    expect(hexInfo.h3_index).toBe('882a1072cffffff');
    expect(hexInfo.active_users).toBe(5);
    
    // Get neighbors
    const neighbors = await service.getNeighbors('882a1072cffffff');
    expect(neighbors.neighbors).toHaveLength(1);
    expect(neighbors.neighbors[0].name).toBe('North Area');
  });
});