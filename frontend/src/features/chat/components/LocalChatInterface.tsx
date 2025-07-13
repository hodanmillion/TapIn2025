import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '@/app/providers/SocketProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useGeolocation } from '@/shared/hooks/useGeolocation';
import { useLocalChat } from '../hooks/useLocalChat';
import { LocationPermissionModal } from './LocationPermissionModal';
import { Message } from '@/types';
import { formatMessageTime } from '@/utils/dateHelpers';
import toast from 'react-hot-toast';

export function LocalChatInterface() {
  const { user } = useAuth();
  const { isConnected, sendMessage: sendSocketMessage, onMessage, offMessage } = useSocket();
  const { coordinates, error: locationError, isSupported, isLoading: isLocationLoading } = useGeolocation({ watch: true });
  const { currentRoom, isJoining, joinLocalChat, updateLocation, leaveCurrentRoom } = useLocalChat();
  
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [hasAutoJoined, setHasAutoJoined] = useState(false);
  
  // Reset state on mount
  useEffect(() => {
    setMessages([]);
    setHasAutoJoined(false);
  }, []);

  // Auto-join local chat when coordinates become available
  useEffect(() => {
    if (coordinates && !currentRoom && !hasAutoJoined && !isJoining) {
      setHasAutoJoined(true);
      joinLocalChatWithCoords(coordinates);
    }
  }, [coordinates, currentRoom, hasAutoJoined, isJoining]);

  // Auto-update location when it changes
  useEffect(() => {
    if (coordinates && currentRoom) {
      updateLocation(coordinates);
    }
  }, [coordinates, currentRoom, updateLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Disconnect WebSocket when component unmounts
      leaveCurrentRoom();
      // Clear local state
      setMessages([]);
      setHasAutoJoined(false);
    };
  }, [leaveCurrentRoom]);

  // Handle socket messages
  useEffect(() => {
    const handleMessage = (data: any) => {
      switch (data.type) {
        case 'NewMessage':
          // Transform backend message format to frontend Message interface
          const msgData = data.data || data; // Handle both wrapped and unwrapped formats
          const transformedMessage: Message = {
            id: msgData._id?.$oid || msgData._id || msgData.id,
            room_id: msgData.room_id,
            user_id: msgData.user_id,
            username: msgData.username,
            content: msgData.content,
            timestamp: msgData.timestamp?.$date?.$numberLong 
              ? new Date(parseInt(msgData.timestamp.$date.$numberLong)).toISOString()
              : msgData.timestamp || new Date().toISOString(),
            edited_at: msgData.edited_at || undefined,
            deleted: msgData.deleted || false,
            reactions: msgData.reactions || []
          };
          setMessages(prev => [...prev, transformedMessage]);
          break;
        case 'MessageHistory':
          // Transform message history format
          const transformedHistory = (data.data?.messages || []).map((msg: any) => ({
            id: msg._id?.$oid || msg._id || msg.id,
            room_id: msg.room_id,
            user_id: msg.user_id,
            username: msg.username,
            content: msg.content,
            timestamp: msg.timestamp?.$date?.$numberLong 
              ? new Date(parseInt(msg.timestamp.$date.$numberLong)).toISOString()
              : msg.timestamp || new Date().toISOString(),
            edited_at: msg.edited_at || undefined,
            deleted: msg.deleted || false,
            reactions: msg.reactions || []
          }));
          setMessages(transformedHistory);
          break;
        case 'UserJoined':
          toast.success(`${data.username} joined the chat`);
          break;
        case 'UserLeft':
          toast(`${data.username} left the chat`, { icon: '👋' });
          break;
      }
    };

    onMessage(handleMessage);
    return () => offMessage(handleMessage);
  }, [onMessage, offMessage]); // Keep minimal dependencies to prevent handler re-registration

  const handleFindLocalChat = () => {
    if (!isSupported) {
      toast.error('Location services not supported in your browser');
      return;
    }

    if (!coordinates) {
      setShowLocationModal(true);
      return;
    }

    joinLocalChatWithCoords(coordinates);
  };

  const joinLocalChatWithCoords = async (coords: { latitude: number; longitude: number }) => {
    try {
      await joinLocalChat(coords);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !isConnected) return;

    sendSocketMessage({
      type: 'Message',
      data: {
        content: trimmedMessage,
      }
    });
    setNewMessage('');
  };

  // Show initial loading state while waiting for location
  if (!currentRoom && !coordinates && isLocationLoading && !locationError) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Getting your location...</p>
          <p className="text-xs text-gray-500 mt-2">Please allow location access when prompted</p>
        </div>
      </div>
    );
  }

  // Show location request if no room and no coordinates yet
  if (!currentRoom && !coordinates) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Find Local Chat</h2>
              <p className="text-gray-600 mb-6">
                Connect with people near you! We'll find or create a chat room for your area.
              </p>
            </div>

            {locationError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-700 text-sm">{locationError.message}</p>
                {locationError.code === 1 && (
                  <p className="text-red-600 text-xs mt-2">
                    Please enable location permissions in your browser settings and refresh the page.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleFindLocalChat}
              disabled={isJoining || !isSupported || isLocationLoading}
              className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="find-local-chat-button"
            >
              {isLocationLoading ? 'Getting Location...' : locationError ? 'Retry' : 'Enable Location & Find Chat'}
            </button>

            <p className="text-xs text-gray-500 mt-4">
              We'll request your location to find nearby chat rooms
            </p>
          </div>
        </div>

        <LocationPermissionModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onLocationGranted={joinLocalChatWithCoords}
        />
      </>
    );
  }

  // Show loading state
  if (isJoining) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Finding local chat...</p>
        </div>
      </div>
    );
  }

  // Show chat interface
  if (currentRoom) {
    return (
      <div className="flex flex-col h-screen" data-testid="chat-interface" data-room-id={currentRoom.roomId}>
        <div className="bg-white shadow-sm px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold" data-testid="room-name">{currentRoom.roomName}</h2>
              <p className="text-sm text-gray-500">
                {currentRoom.userCount} user{currentRoom.userCount !== 1 ? 's' : ''} nearby
                {currentRoom.isNewRoom && ' • You started this chat!'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-500">
                {isConnected ? 'Connected' : 'Reconnecting...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.user_id === user?.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-900 shadow-sm'
                }`}
              >
                {message.user_id !== user?.id && (
                  <Link 
                    to={`/profile/${message.username}`}
                    className="text-sm font-semibold mb-1 opacity-75 hover:opacity-100 hover:underline cursor-pointer block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {message.username}
                  </Link>
                )}
                <p>{message.content}</p>
                <p className="text-xs opacity-75 mt-1">
                  {formatMessageTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="bg-white border-t p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              disabled={!isConnected}
              data-testid="message-input"
            />
            <button
              type="submit"
              disabled={!isConnected || !newMessage.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="send-button"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}