import React, { useMemo } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import ConversationItem from './ConversationItem';
import ConversationSearch from './ConversationSearch';

/**
 * ConversationList Component
 * Displays a list of conversations with search functionality
 */
const ConversationList = ({ 
  conversations = [],
  activeConversationId,
  loading = false,
  error = '',
  searchQuery = '',
  onSearchChange = () => {},
  onConversationClick = () => {},
  onErrorDismiss = () => {}
}) => {
  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }

    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => {
      const participant = conv.participant;
      if (!participant) return false;

      return (
        participant.username.toLowerCase().includes(query) ||
        (participant.fullName && participant.fullName.toLowerCase().includes(query)) ||
        (conv.lastMessagePreview && conv.lastMessagePreview.toLowerCase().includes(query))
      );
    });
  }, [conversations, searchQuery]);

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" />
        <p className="mt-2">Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" onClose={onErrorDismiss} dismissible>
        {error}
      </Alert>
    );
  }

  return (
    <div className="conversation-list">
      <ConversationSearch
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      <div className="conversations-container">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.conversationId}
              conversation={conversation}
              isActive={activeConversationId === conversation.conversationId}
              onClick={() => onConversationClick(conversation)}
            />
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">
              {searchQuery ? `No conversations found matching "${searchQuery}"` : 'No conversations yet'}
            </div>
            <div className="empty-state-description">
              {searchQuery 
                ? 'Try searching with a different term' 
                : 'Start a conversation by sending a message to a friend'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;

