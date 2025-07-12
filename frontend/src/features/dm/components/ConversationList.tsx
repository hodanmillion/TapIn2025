import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dmService } from '../../../services/dm.service';
import { Conversation } from '../../../types';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../auth/hooks/useAuth';

export const ConversationList: React.FC = () => {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentUserProfile();
  }, [token]);

  useEffect(() => {
    if (currentUserProfile) {
      loadConversations();
    }
  }, [currentUserProfile]);

  const loadCurrentUserProfile = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/v1/profile/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const profile = await response.json();
        setCurrentUserProfile(profile);
      }
    } catch (error) {
      console.error('Failed to load current user profile:', error);
    }
  };

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const data = await dmService.getConversations();
      console.log('Conversations data:', data); // Debug log
      
      // dmService.getConversations() already extracts the conversations array
      if (Array.isArray(data)) {
        setConversations(data);
      } else {
        console.error('Unexpected data format:', data);
        setConversations([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        {error}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="mb-4">No conversations yet</p>
        <p className="text-sm">Start a conversation by visiting someone's profile</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => {
        // Find the other participant (not the current user)
        // The API returns participants with a nested user object
        const otherParticipantData = conversation.participants?.find(p => p.user?.id !== currentUserProfile?.id);
        const otherUser = otherParticipantData?.user;
        
        return (
          <Link
            key={conversation.id}
            to={`/messages/${conversation.id}`}
            className="block p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start space-x-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {otherUser?.avatarUrl ? (
                  <img
                    src={otherUser.avatarUrl}
                    alt={otherUser.displayName || otherUser.username}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-600 font-medium">
                      {(otherUser?.displayName || otherUser?.username || '?')[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {otherUser?.displayName || otherUser?.username || 'Unknown User'}
                  </h3>
                  {conversation.lastMessageAt && (
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
                
                {conversation.lastMessage && (
                  <p className="mt-1 text-sm text-gray-600 truncate">
                    {conversation.lastMessage}
                  </p>
                )}

                {conversation.unreadCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                    {conversation.unreadCount} unread
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};