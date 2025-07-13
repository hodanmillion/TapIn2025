import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDM } from '../hooks/useDM';
import { useAuth } from '../../auth/hooks/useAuth';
import { formatRelativeTime } from '@/utils/dateHelpers';

interface DMChatInterfaceProps {
  conversationId: string;
}

export const DMChatInterface: React.FC<DMChatInterfaceProps> = ({ conversationId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    messages,
    conversation,
    isConnected,
    isLoading,
    error,
    typingUsers,
    sendMessage,
    sendTyping,
    markAsRead,
    loadMoreMessages,
    hasMore
  } = useDM({ conversationId });

  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    const timer = setTimeout(() => {
      markAsRead();
    }, 1000);
    return () => clearTimeout(timer);
  }, [markAsRead, messages]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
      sendTyping(true);
    } else if (isTyping && e.target.value.length === 0) {
      setIsTyping(false);
      sendTyping(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !isConnected) return;

    sendMessage(messageInput);
    setMessageInput('');
    setIsTyping(false);
    sendTyping(false);
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop } = messagesContainerRef.current;
      if (scrollTop === 0 && hasMore && !isLoading) {
        loadMoreMessages();
      }
    }
  };

  if (error && !isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const otherParticipant = conversation?.participants.find(p => p.user.id !== user?.id)?.user;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center space-x-3 p-4 border-b">
        <button
          onClick={() => navigate('/messages')}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        
        {otherParticipant?.avatarUrl ? (
          <img
            src={otherParticipant.avatarUrl}
            alt={otherParticipant.displayName || otherParticipant.username}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-600 font-medium">
              {(otherParticipant?.displayName || otherParticipant?.username || '?')[0].toUpperCase()}
            </span>
          </div>
        )}
        
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">
            {otherParticipant?.displayName || otherParticipant?.username || 'Unknown User'}
          </h2>
          {!isConnected && (
            <p className="text-xs text-gray-500">Connecting...</p>
          )}
          {typingUsers.size > 0 && (
            <p className="text-xs text-gray-500">Typing...</p>
          )}
        </div>

        <Link
          to={`/profile/${otherParticipant?.username}`}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          View Profile
        </Link>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>No messages yet</p>
            <p className="text-sm mt-2">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isOwnMessage = message.senderId === user?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isOwnMessage 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {!isOwnMessage && (
                      <Link 
                        to={`/profile/${message.senderUsername}`}
                        className="text-xs font-medium mb-1 opacity-75 hover:opacity-100 hover:underline cursor-pointer block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {message.senderUsername}
                      </Link>
                    )}
                    <p className="text-sm break-words">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatRelativeTime(message.timestamp)}
                      {message.editedAt && ' (edited)'}
                    </p>
                    {isOwnMessage && message.readBy.length > 1 && (
                      <p className="text-xs text-blue-100 mt-1">Read</p>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={messageInput}
            onChange={handleInputChange}
            onBlur={() => {
              setIsTyping(false);
              sendTyping(false);
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!isConnected}
          />
          <button
            type="submit"
            disabled={!messageInput.trim() || !isConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
};