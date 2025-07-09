import { useState, useCallback, useEffect } from 'react';
import { useSocket } from '@/app/providers/SocketProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { GeolocationCoordinates } from '@/shared/hooks/useGeolocation';
import toast from 'react-hot-toast';

export interface LocalChatRoom {
  roomId: string;
  roomName: string;
  isNewRoom: boolean;
  userCount: number;
  location: {
    type: string;
    coordinates: [number, number];
  };
}

export interface LocalChatError {
  message: string;
}

export function useLocalChat() {
  const { sendMessage, onMessage, offMessage, connectToLocation, isConnected } = useSocket();
  const { user } = useAuth();
  const [currentRoom, setCurrentRoom] = useState<LocalChatRoom | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<LocalChatError | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (data: any) => {
      console.log('Received message in useLocalChat:', data);
      
      switch (data.type) {
        case 'RoomJoined':
          setCurrentRoom({
            roomId: data.room_id,
            roomName: data.room_name,
            isNewRoom: data.is_new_room,
            userCount: data.user_count,
            location: data.location,
          });
          setIsJoining(false);
          
          if (data.is_new_room) {
            toast.success(`Created new local chat: ${data.room_name}`);
          } else {
            toast.success(`Joined local chat: ${data.room_name}`);
          }
          break;
          
        // Handle MessageHistory as a sign we've joined (workaround for backend)
        case 'MessageHistory':
          if (isJoining && currentLocationId) {
            // Parse coordinates from location ID
            const parts = currentLocationId.split('_');
            if (parts.length === 2) {
              const lat = parseFloat(parts[0]);
              const lon = parseFloat(parts[1]);
              
              setCurrentRoom({
                roomId: currentLocationId,
                roomName: `Local Chat @ ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                isNewRoom: !data.data.messages || data.data.messages.length === 0,
                userCount: 1, // Will be updated by UserJoined messages
                location: {
                  type: 'Point',
                  coordinates: [lon, lat]
                },
              });
              setIsJoining(false);
              
              const isNew = !data.data.messages || data.data.messages.length === 0;
              if (isNew) {
                toast.success(`Created new local chat`);
              } else {
                toast.success(`Joined local chat`);
              }
            }
          }
          break;
          
        case 'Error':
          setError({ message: data.message });
          setIsJoining(false);
          toast.error(data.message);
          break;
          
        case 'UserJoined':
          setCurrentRoom(prevRoom => {
            if (prevRoom) {
              return {
                ...prevRoom,
                userCount: (prevRoom.userCount || 1) + 1
              };
            }
            return prevRoom;
          });
          break;
          
        case 'UserLeft':
          setCurrentRoom(prevRoom => {
            if (prevRoom) {
              return {
                ...prevRoom,
                userCount: Math.max(1, (prevRoom.userCount || 1) - 1)
              };
            }
            return prevRoom;
          });
          break;
      }
    };

    onMessage(handleMessage);
    return () => offMessage(handleMessage);
  }, [onMessage, offMessage]); // Removed currentRoom dependency to prevent handler re-registration

  const joinLocalChat = useCallback(async (
    coordinates: GeolocationCoordinates
  ) => {
    if (!user) {
      setError({ message: 'Not authenticated' });
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Connect to WebSocket with coordinates - this will automatically send JoinLocalChat
      const tempLocationId = `${coordinates.latitude}_${coordinates.longitude}`;
      setCurrentLocationId(tempLocationId);
      connectToLocation(tempLocationId);

      // Wait for response (the actual response will be handled by the message handler above)
      return new Promise<LocalChatRoom>((resolve, reject) => {
        const timeout = setTimeout(() => {
          setIsJoining(false);
          reject(new Error('Request timeout'));
        }, 10000);

        // Watch for state changes
        const checkInterval = setInterval(() => {
          if (currentRoom) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve(currentRoom);
          } else if (error) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            reject(new Error(error.message));
          }
        }, 100);
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to join local chat';
      setError({ message: errorMsg });
      setIsJoining(false);
      toast.error(errorMsg);
      throw err;
    }
  }, [user, connectToLocation, currentRoom, error]);

  const updateLocation = useCallback((coordinates: GeolocationCoordinates) => {
    if (!user || !isConnected) return;

    sendMessage({
      type: 'LocationUpdate',
      user_id: user.id,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
  }, [user, isConnected, sendMessage]);

  const leaveCurrentRoom = useCallback(() => {
    setCurrentRoom(null);
    setError(null);
  }, []);

  return {
    currentRoom,
    isJoining,
    error,
    joinLocalChat,
    updateLocation,
    leaveCurrentRoom,
  };
}