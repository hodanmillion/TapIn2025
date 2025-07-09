import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '@/app/providers/SocketProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { chatService } from '@/services/chat.service';
import { Message } from '@/types';
import toast from 'react-hot-toast';

export function ChatPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const { user } = useAuth();
  const { isConnected, connectToLocation, sendMessage: sendSocketMessage, onMessage, offMessage } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    // Connect to location WebSocket
    connectToLocation(locationId);

    // Load initial messages
    loadMessages();

    return () => {
      // Cleanup handled by SocketProvider
    };
  }, [locationId, connectToLocation]);

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
          toast.success(`${data.data.username} joined the chat`);
          break;
        case 'UserLeft':
          toast(`${data.data.username} left the chat`, { icon: '👋' });
          break;
        case 'Error':
          toast.error(data.data.message || 'Connection error');
          break;
      }
    };

    onMessage(handleMessage);
    return () => offMessage(handleMessage);
  }, [onMessage, offMessage]);

  const loadMessages = async () => {
    if (!locationId) return;
    
    try {
      setIsLoading(true);
      const msgs = await chatService.getMessages(locationId);
      setMessages(msgs);
    } catch (error) {
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !locationId || !isConnected) return;

    sendSocketMessage({
      type: 'Message',
      data: {
        content: trimmedMessage
      }
    });
    setNewMessage('');
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white shadow-sm px-4 py-3">
        <h2 className="text-lg font-semibold">Location Chat</h2>
        <p className="text-sm text-gray-500">
          {isConnected ? 'Connected' : 'Connecting...'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
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
              <p className="text-sm font-semibold">{message.username}</p>
              <p>{message.content}</p>
              <p className="text-xs opacity-75 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            disabled={!isConnected}
          />
          <button
            type="submit"
            disabled={!isConnected || !newMessage.trim()}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}