import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { dmService } from '../../../services/dm.service';
import { useAuth } from '../../auth/hooks/useAuth';

interface StartConversationButtonProps {
  userId: string;
  username: string;
}

export const StartConversationButton: React.FC<StartConversationButtonProps> = ({ 
  userId
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't show button for own profile
  if (user?.id === userId) {
    return null;
  }

  const handleStartConversation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const conversation = await dmService.createConversation({ userId });
      navigate(`/messages/${conversation.id}`);
    } catch (err: any) {
      console.error('Failed to start conversation:', err);
      
      if (err.response?.status === 409) {
        // Conversation already exists, navigate to it
        const existingConversationId = err.response.data.conversationId;
        if (existingConversationId) {
          navigate(`/messages/${existingConversationId}`);
        } else {
          setError('Conversation already exists');
        }
      } else {
        setError('Failed to start conversation');
      }
      
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleStartConversation}
        disabled={isLoading}
        className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Starting...</span>
          </>
        ) : (
          <>
            <MessageCircle className="h-4 w-4" />
            <span>Message</span>
          </>
        )}
      </button>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </>
  );
};