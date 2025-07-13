import { useState, useEffect, useCallback, useRef } from 'react';
import { dmService } from '../../../services/dm.service';
import { useAuth } from '../../auth/hooks/useAuth';
import { DirectMessage, DMWebSocketMessage, Conversation } from '../../../types';

interface UseDMOptions {
  conversationId: string;
}

interface UseDMReturn {
  messages: DirectMessage[];
  conversation: Conversation | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  typingUsers: Set<string>;
  sendMessage: (content: string) => void;
  sendTyping: (isTyping: boolean) => void;
  markAsRead: () => void;
  loadMoreMessages: () => Promise<void>;
  hasMore: boolean;
}

export const useDM = ({ conversationId }: UseDMOptions): UseDMReturn => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversation details
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const conv = await dmService.getConversation(conversationId);
        setConversation(conv);
      } catch (err) {
        console.error('Failed to load conversation:', err);
        setError('Failed to load conversation');
      }
    };

    loadConversation();
  }, [conversationId]);

  // Connect to WebSocket
  useEffect(() => {
    if (!user || !token) return;

    const connect = () => {
      try {
        const ws = new WebSocket(dmService.getDMWebSocketUrl(conversationId));
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('DM WebSocket connected');
          setIsConnected(true);
          setError(null);
          
          // Send join message
          const joinMessage: DMWebSocketMessage = {
            type: 'JoinDM',
            data: {
              conversation_id: conversationId,
              user_id: user.id,
              username: user.username,
              token
            }
          };
          ws.send(JSON.stringify(joinMessage));
        };

        ws.onmessage = (event) => {
          try {
            const message: DMWebSocketMessage = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error');
        };

        ws.onclose = () => {
          console.log('DM WebSocket disconnected');
          setIsConnected(false);
          wsRef.current = null;
          
          // Attempt to reconnect after 3 seconds
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              connect();
            }, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to connect to WebSocket:', err);
        setError('Failed to connect');
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [conversationId, user, token]);

  const handleWebSocketMessage = (message: DMWebSocketMessage) => {
    switch (message.type) {
      case 'DMJoined':
        setIsLoading(false);
        break;
        
      case 'MessageHistory':
        setMessages(message.data.messages.map((msg: any) => ({
          id: msg._id?.$oid || msg.id,
          conversationId: msg.room_id,
          senderId: msg.user_id,
          senderUsername: msg.username,
          content: msg.content,
          timestamp: msg.timestamp?.$date?.$numberLong 
            ? new Date(parseInt(msg.timestamp.$date.$numberLong)).toISOString()
            : msg.timestamp || new Date().toISOString(),
          editedAt: msg.edited_at,
          deleted: msg.deleted || false,
          readBy: msg.read_by || []
        })));
        setIsLoading(false);
        break;
        
      case 'NewMessage':
        const newMsg: DirectMessage = {
          id: message.data._id?.$oid || message.data.id,
          conversationId: message.data.room_id,
          senderId: message.data.user_id,
          senderUsername: message.data.username,
          content: message.data.content,
          timestamp: message.data.timestamp?.$date?.$numberLong 
            ? new Date(parseInt(message.data.timestamp.$date.$numberLong)).toISOString()
            : message.data.timestamp || new Date().toISOString(),
          editedAt: message.data.edited_at,
          deleted: message.data.deleted || false,
          readBy: message.data.read_by || []
        };
        setMessages(prev => [...prev, newMsg]);
        break;
        
      case 'Typing':
        // TODO: Handle typing indicators with user info
        break;
        
      case 'Error':
        console.error('DM error:', message.data.message);
        setError(message.data.message);
        break;
    }
  };

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || !isConnected || !user) return;

    const message: DMWebSocketMessage = {
      type: 'DMMessage',
      data: {
        conversation_id: conversationId,
        content
      }
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, [isConnected, conversationId, user]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!wsRef.current || !isConnected) return;

    // Clear existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const message: DMWebSocketMessage = {
      type: 'DMTyping',
      data: {
        conversation_id: conversationId,
        is_typing: isTyping
      }
    };
    
    wsRef.current.send(JSON.stringify(message));

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 3000);
    }
  }, [isConnected, conversationId]);

  const markAsRead = useCallback(() => {
    if (!wsRef.current || !isConnected || !user) return;

    const message: DMWebSocketMessage = {
      type: 'DMRead',
      data: {
        conversation_id: conversationId,
        user_id: user.id
      }
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, [isConnected, conversationId, user]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || messages.length === 0) return;

    try {
      const oldestMessage = messages[0];
      const moreMessages = await dmService.getMessages(
        conversationId,
        50,
        oldestMessage.id
      );
      
      if (moreMessages.length < 50) {
        setHasMore(false);
      }
      
      setMessages(prev => [...moreMessages, ...prev]);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    }
  }, [conversationId, messages, hasMore]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
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
  };
};