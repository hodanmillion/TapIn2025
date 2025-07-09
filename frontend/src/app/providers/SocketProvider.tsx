import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface SocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  connectToLocation: (locationId: string) => void;
  disconnectFromLocation: () => void;
  sendMessage: (message: any) => void;
  onMessage: (handler: (data: any) => void) => void;
  offMessage: (handler: (data: any) => void) => void;
}

const SocketContext = createContext<SocketContextType>({ 
  socket: null, 
  isConnected: false,
  connectToLocation: () => {},
  disconnectFromLocation: () => {},
  sendMessage: () => {},
  onMessage: () => {},
  offMessage: () => {}
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const messageHandlersRef = useRef<Set<(data: any) => void>>(new Set());
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);

  const connectToLocation = useCallback((locationId: string) => {
    if (currentLocationId === locationId) return;
    
    disconnectFromLocation();
    
    if (!token || !user) return;

    // WebSocket connection to chat service
    const chatApiUrl = import.meta.env.VITE_CHAT_API_URL || 'http://localhost:3001';
    const wsProtocol = chatApiUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = chatApiUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${wsHost}/ws/${locationId}`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setCurrentLocationId(locationId);
      
      // Send join message after connection is established
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'Join',
          data: {
            user_id: user.id,
            username: user.username,
            token: token
          }
        }));
      }
    };
    
    socketRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setCurrentLocationId(null);
    };
    
    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        messageHandlersRef.current.forEach(handler => handler(data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }, [currentLocationId, token, user]);

  const disconnectFromLocation = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setIsConnected(false);
      setCurrentLocationId(null);
    }
  }, []);
  
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket message:', message);
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);
  
  const onMessage = useCallback((handler: (data: any) => void) => {
    messageHandlersRef.current.add(handler);
  }, []);
  
  const offMessage = useCallback((handler: (data: any) => void) => {
    messageHandlersRef.current.delete(handler);
  }, []);

  useEffect(() => {
    return () => {
      disconnectFromLocation();
    };
  }, [disconnectFromLocation]);

  return (
    <SocketContext.Provider value={{ 
      socket: socketRef.current, 
      isConnected,
      connectToLocation,
      disconnectFromLocation,
      sendMessage,
      onMessage,
      offMessage
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);