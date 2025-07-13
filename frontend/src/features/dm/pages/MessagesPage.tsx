import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConversationList } from '../components/ConversationList';
import { DMChatInterface } from '../components/DMChatInterface';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const MessagesPage: React.FC = () => {
  const { conversationId } = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-full flex">
      {/* Conversation list - hide on mobile when viewing a conversation */}
      <div className={`${conversationId ? 'hidden lg:block' : 'block'} ${sidebarCollapsed ? 'w-12' : 'w-full lg:w-96'} border-r transition-all duration-300 relative`}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:block absolute -right-3 top-4 z-10 bg-white border border-gray-200 rounded-full p-1 hover:bg-gray-100"
          title={sidebarCollapsed ? 'Expand messages' : 'Collapse messages'}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        
        {!sidebarCollapsed && (
          <>
            <div className="p-4 border-b">
              <h1 className="text-xl font-semibold">Messages</h1>
            </div>
            <ConversationList />
          </>
        )}
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