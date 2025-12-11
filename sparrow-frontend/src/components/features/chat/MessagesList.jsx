import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

const MessagesList = ({ messages, currentUserId }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💭</div>
        <div className="empty-state-title">No messages yet</div>
        <div className="empty-state-description">Start the conversation!</div>
      </div>
    );
  }

  return (
    <div className="chat-messages">
      {messages.map((msg, index) => (
        <MessageBubble
          key={msg._id || msg.id || index}
          message={msg}
          currentUserId={currentUserId}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessagesList;

