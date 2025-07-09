import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hexService } from '@/services/hex.service';
import { useLocation } from '@/app/providers/LocationProvider';
import { useSocket } from '@/app/providers/SocketProvider';
import { toast } from 'react-hot-toast';

export interface HexCell {
  h3_index: string;
  resolution: number;
  center: { lat: number; lng: number };
  display_name: string;
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

export function useHexChat() {
  const navigate = useNavigate();
  const { currentLocation, requestLocation } = useLocation();
  const { connectToHex, isConnected } = useSocket();
  
  const [currentHex, setCurrentHex] = useState<HexCell | null>(null);
  const [neighbors, setNeighbors] = useState<NeighborHex[]>([]);
  const [loading, setLoading] = useState(false);
  
  const joinNearbyHex = useCallback(async (resolution: number = 8) => {
    if (!currentLocation) {
      requestLocation();
      return;
    }
    
    setLoading(true);
    try {
      const response = await hexService.joinHex(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        resolution
      );
      
      setCurrentHex(response.hex_cell);
      setNeighbors(response.neighbors);
      
      // Navigate to hex chat room
      navigate(`/hex/${response.hex_cell.h3_index}`);
      
      // Connect WebSocket to hex
      connectToHex(response.hex_cell.h3_index);
      
    } catch (error) {
      toast.error('Failed to join neighborhood chat');
      console.error('Join hex error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentLocation, navigate, connectToHex, requestLocation]);
  
  const switchToNeighbor = useCallback(async (neighborHex: NeighborHex) => {
    navigate(`/hex/${neighborHex.h3_index}`);
    connectToHex(neighborHex.h3_index);
  }, [navigate, connectToHex]);
  
  const getHexInfo = useCallback(async (h3Index: string) => {
    try {
      const hexInfo = await hexService.getHexInfo(h3Index);
      setCurrentHex(hexInfo);
      
      const neighborInfo = await hexService.getNeighbors(h3Index);
      setNeighbors(neighborInfo.neighbors);
    } catch (error) {
      console.error('Failed to get hex info:', error);
    }
  }, []);
  
  return {
    currentHex,
    neighbors,
    loading,
    isConnected,
    joinNearbyHex,
    switchToNeighbor,
    getHexInfo,
  };
}