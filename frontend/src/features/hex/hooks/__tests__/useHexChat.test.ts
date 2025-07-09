import { renderHook, act } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useHexChat } from '../useHexChat';
import { hexService } from '@/services/hex.service';
import { useLocation } from '@/app/providers/LocationProvider';
import { useSocket } from '@/app/providers/SocketProvider';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
  },
}));

jest.mock('@/services/hex.service', () => ({
  hexService: {
    joinHex: jest.fn(),
    getHexInfo: jest.fn(),
    getNeighbors: jest.fn(),
  },
}));

jest.mock('@/app/providers/LocationProvider', () => ({
  useLocation: jest.fn(),
}));

jest.mock('@/app/providers/SocketProvider', () => ({
  useSocket: jest.fn(),
}));

describe('useHexChat', () => {
  const mockNavigate = jest.fn();
  const mockRequestLocation = jest.fn();
  const mockConnectToHex = jest.fn();
  
  const mockCurrentLocation = {
    coords: {
      latitude: 40.7589,
      longitude: -73.9851,
    },
  };
  
  const sampleHexResponse = {
    hex_cell: {
      h3_index: '882a1072cffffff',
      resolution: 8,
      center: { lat: 40.7589, lng: -73.9851 },
      display_name: 'Test Neighborhood',
      active_users: 5,
      boundary: [[40.759, -73.985], [40.758, -73.984]],
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
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (useLocation as jest.Mock).mockReturnValue({
      currentLocation: mockCurrentLocation,
      requestLocation: mockRequestLocation,
    });
    (useSocket as jest.Mock).mockReturnValue({
      connectToHex: mockConnectToHex,
      isConnected: true,
    });
  });
  
  describe('joinNearbyHex', () => {
    it('should join hex successfully with current location', async () => {
      (hexService.joinHex as jest.Mock).mockResolvedValue(sampleHexResponse);
      
      const { result } = renderHook(() => useHexChat());
      
      await act(async () => {
        await result.current.joinNearbyHex(8);
      });
      
      expect(hexService.joinHex).toHaveBeenCalledWith(40.7589, -73.9851, 8);
      expect(mockNavigate).toHaveBeenCalledWith('/hex/882a1072cffffff');
      expect(mockConnectToHex).toHaveBeenCalledWith('882a1072cffffff');
      expect(result.current.currentHex).toEqual(sampleHexResponse.hex_cell);
      expect(result.current.neighbors).toEqual(sampleHexResponse.neighbors);
    });
    
    it('should request location when not available', async () => {
      (useLocation as jest.Mock).mockReturnValue({
        currentLocation: null,
        requestLocation: mockRequestLocation,
      });
      
      const { result } = renderHook(() => useHexChat());
      
      await act(async () => {
        await result.current.joinNearbyHex(8);
      });
      
      expect(mockRequestLocation).toHaveBeenCalled();
      expect(hexService.joinHex).not.toHaveBeenCalled();
    });
    
    it('should handle join hex error', async () => {
      const error = new Error('Join failed');
      (hexService.joinHex as jest.Mock).mockRejectedValue(error);
      
      const { result } = renderHook(() => useHexChat());
      
      await act(async () => {
        await result.current.joinNearbyHex(8);
      });
      
      expect(toast.error).toHaveBeenCalledWith('Failed to join neighborhood chat');
      expect(mockNavigate).not.toHaveBeenCalled();
    });
    
    it('should show loading state during join', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (hexService.joinHex as jest.Mock).mockReturnValue(promise);
      
      const { result } = renderHook(() => useHexChat());
      
      act(() => {
        result.current.joinNearbyHex(8);
      });
      
      expect(result.current.loading).toBe(true);
      
      await act(async () => {
        resolvePromise!(sampleHexResponse);
        await promise;
      });
      
      expect(result.current.loading).toBe(false);
    });
  });
  
  describe('switchToNeighbor', () => {
    it('should switch to neighbor hex', async () => {
      const neighbor = {
        h3_index: 'neighbor1',
        name: 'North Area',
        active_users: 3,
        distance_km: 0.5,
        direction: 'north',
      };
      
      const { result } = renderHook(() => useHexChat());
      
      await act(async () => {
        await result.current.switchToNeighbor(neighbor);
      });
      
      expect(mockNavigate).toHaveBeenCalledWith('/hex/neighbor1');
      expect(mockConnectToHex).toHaveBeenCalledWith('neighbor1');
    });
  });
  
  describe('getHexInfo', () => {
    it('should get hex info and neighbors', async () => {
      const hexInfo = sampleHexResponse.hex_cell;
      const neighborsResponse = { neighbors: sampleHexResponse.neighbors };
      
      (hexService.getHexInfo as jest.Mock).mockResolvedValue(hexInfo);
      (hexService.getNeighbors as jest.Mock).mockResolvedValue(neighborsResponse);
      
      const { result } = renderHook(() => useHexChat());
      
      await act(async () => {
        await result.current.getHexInfo('882a1072cffffff');
      });
      
      expect(hexService.getHexInfo).toHaveBeenCalledWith('882a1072cffffff');
      expect(hexService.getNeighbors).toHaveBeenCalledWith('882a1072cffffff');
      expect(result.current.currentHex).toEqual(hexInfo);
      expect(result.current.neighbors).toEqual(neighborsResponse.neighbors);
    });
    
    it('should handle error when getting hex info', async () => {
      const error = new Error('Get hex info failed');
      (hexService.getHexInfo as jest.Mock).mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const { result } = renderHook(() => useHexChat());
      
      await act(async () => {
        await result.current.getHexInfo('882a1072cffffff');
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get hex info:', error);
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useHexChat());
      
      expect(result.current.currentHex).toBeNull();
      expect(result.current.neighbors).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.isConnected).toBe(true);
    });
  });
  
  describe('with custom resolution', () => {
    it('should use custom resolution when joining', async () => {
      (hexService.joinHex as jest.Mock).mockResolvedValue(sampleHexResponse);
      
      const { result } = renderHook(() => useHexChat());
      
      await act(async () => {
        await result.current.joinNearbyHex(9); // Block level
      });
      
      expect(hexService.joinHex).toHaveBeenCalledWith(40.7589, -73.9851, 9);
    });
  });
});


// Integration test
describe('useHexChat integration', () => {
  it('should handle full user flow', async () => {
    const mockNavigate = jest.fn();
    const mockRequestLocation = jest.fn();
    const mockConnectToHex = jest.fn();
    
    const mockCurrentLocation = {
      coords: {
        latitude: 40.7589,
        longitude: -73.9851,
      },
    };
    
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (useLocation as jest.Mock).mockReturnValue({
      currentLocation: mockCurrentLocation,
      requestLocation: mockRequestLocation,
    });
    (useSocket as jest.Mock).mockReturnValue({
      connectToHex: mockConnectToHex,
      isConnected: true,
    });
    
    const joinResponse = {
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
    };
    
    (hexService.joinHex as jest.Mock).mockResolvedValue(joinResponse);
    
    const { result } = renderHook(() => useHexChat());
    
    // Step 1: Join nearby hex
    await act(async () => {
      await result.current.joinNearbyHex(8);
    });
    
    expect(result.current.currentHex).toEqual(joinResponse.hex_cell);
    expect(result.current.neighbors).toEqual(joinResponse.neighbors);
    expect(mockNavigate).toHaveBeenCalledWith('/hex/882a1072cffffff');
    expect(mockConnectToHex).toHaveBeenCalledWith('882a1072cffffff');
    
    // Step 2: Switch to neighbor
    await act(async () => {
      await result.current.switchToNeighbor(joinResponse.neighbors[0]);
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/hex/neighbor1');
    expect(mockConnectToHex).toHaveBeenCalledWith('neighbor1');
  });
});