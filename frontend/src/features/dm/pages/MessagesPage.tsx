import React from 'react';
import { useParams } from 'react-router-dom';
import { ConversationList } from '../components/ConversationList';
import { DMChatInterface } from '../components/DMChatInterface';

export const MessagesPage: React.FC = () => {
  const { conversationId } = useParams();

  return (
    <div className="h-full flex">
      {/* Conversation list - hide on mobile when viewing a conversation */}
      <div className={`${conversationId ? 'hidden lg:block' : 'block'} w-full lg:w-96 border-r`}>
        <div className="p-4 border-b">
          <h1 className="text-xl font-semibold">Messages</h1>
        </div>
        <ConversationList />
      </div>

      {/* Chat area */}
      <div className={`${conversationId ? 'block' : 'hidden lg:block'} flex-1`}>
        {conversationId ? (
          <DMChatInterface conversationId={conversationId} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};