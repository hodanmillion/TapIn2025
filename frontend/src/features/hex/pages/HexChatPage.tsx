import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useHexChat } from '../hooks/useHexChat';
import { HexMap } from '../components/HexMap';
import { NeighborList } from '../components/NeighborList';
import { ResolutionSelector } from '../components/ResolutionSelector';
import { useSocket } from '@/app/providers/SocketProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Message } from '@/types';
import toast from 'react-hot-toast';

export function HexChatPage() {
  const { h3Index } = useParams<{ h3Index: string }>();
  const { user } = useAuth();
  const { isConnected, sendMessage: sendSocketMessage, onMessage, offMessage } = useSocket();
  const { 
    currentHex, 
    neighbors, 
    loading, 
    getHexInfo,
    switchToNeighbor 
  } = useHexChat();
  const [showMap, setShowMap] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  useEffect(() => {
    if (h3Index) {
      getHexInfo(h3Index);
    }
  }, [h3Index, getHexInfo]);

  useEffect(() => {
    const handleMessage = (data: any) => {
      switch (data.type) {
        case 'NewMessage':
          setMessages((prev) => [...prev, data.data as Message]);
          break;
        case 'MessageHistory':
          setMessages(data.data.messages);
          break;
        case 'UserJoined':
          toast.success(`${data.data.username} joined the hex chat`);
          break;
        case 'UserLeft':
          toast(`${data.data.username} left the hex chat`, { icon: '👋' });
          break;
        case 'HexJoined':
          toast.success('Connected to hex chat');
          break;
        case 'Error':
          toast.error(data.data.message || 'Connection error');
          break;
      }
    };

    onMessage(handleMessage);
    return () => offMessage(handleMessage);
  }, [onMessage, offMessage]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !h3Index || !isConnected) return;

    sendSocketMessage({
      type: 'Message',
      data: {
        content: trimmedMessage
      }
    });
    setNewMessage('');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Connecting to neighborhood...</p>
        </div>
      </div>
    );
  }
  
  if (!currentHex) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Hex cell not found</p>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex">
      {/* Left sidebar - Neighbors */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Nearby Areas</h2>
          <NeighborList 
            neighbors={neighbors}
            onSelectNeighbor={switchToNeighbor}
          />
        </div>
      </div>
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header with hex info */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">
                {currentHex.display_name || 'Neighborhood Chat'}
              </h1>
              <p className="text-sm text-gray-600">
                {currentHex.active_users} {currentHex.active_users === 1 ? 'person' : 'people'} here
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <ResolutionSelector currentResolution={currentHex.resolution} />
              <button
                onClick={() => setShowMap(!showMap)}
                className="p-2 rounded-lg hover:bg-gray-100"
                title="Toggle map"
              >
                📍
              </button>
            </div>
          </div>
        </div>
        
        {/* Map overlay (toggleable) */}
        {showMap && (
          <div className="h-48 border-b border-gray-200">
            <HexMap
              hexCell={currentHex}
              neighbors={neighbors}
              userPosition={undefined}
            />
          </div>
        )}
        
        {/* Chat messages and input */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500">
                <p>No messages yet. Be the first to say hello!</p>
                <p className="text-sm">Connected: {isConnected ? 'Yes' : 'No'}</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      message.user_id === user?.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {message.user_id !== user?.id ? (
                      <Link 
                        to={`/profile/${message.username}`}
                        className="text-sm font-semibold hover:underline cursor-pointer block mb-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {message.username}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold mb-1">{message.username}</p>
                    )}
                    <p>{message.content}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={sendMessage} className="border-t border-gray-200 p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={!isConnected}
              />
              <button
                type="submit"
                disabled={!isConnected || !newMessage.trim()}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}