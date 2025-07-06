import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectToLocation: (locationId: string) => void;
  disconnectFromLocation: () => void;
}

const SocketContext = createContext<SocketContextType>({ 
  socket: null, 
  isConnected: false,
  connectToLocation: () => {},
  disconnectFromLocation: () => {}
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);

  const connectToLocation = (locationId: string) => {
    if (currentLocationId === locationId) return;
    
    disconnectFromLocation();
    
    if (!token) return;

    // WebSocket connection to chat service
    const wsUrl = `${import.meta.env.VITE_CHAT_API_URL || 'http://localhost:3001'}/ws/${locationId}`;
    
    socketRef.current = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      setCurrentLocationId(locationId);
    });
    
    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      setCurrentLocationId(null);
    });
  };

  const disconnectFromLocation = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setCurrentLocationId(null);
    }
  };

  useEffect(() => {
    return () => {
      disconnectFromLocation();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socket: socketRef.current, 
      isConnected,
      connectToLocation,
      disconnectFromLocation
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);