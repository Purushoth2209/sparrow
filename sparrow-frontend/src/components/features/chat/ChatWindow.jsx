import React, { useEffect } from 'react';
import ChatHeader from './ChatHeader';
import MessagesList from './MessagesList';

const ChatWindow = ({ friend, messages, onCloseChat, onRemoveFriend, showBackButton = false }) => {
  const currentUserId = localStorage.getItem('profileId');

  // Handle escape key to close chat
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onCloseChat) {
        onCloseChat();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCloseChat]);

  return (
    <div className="chat-container h-100 d-flex flex-column">
      <ChatHeader
        friend={friend}
        onCloseChat={onCloseChat}
        onRemoveFriend={onRemoveFriend}
        showBackButton={showBackButton}
      />
      <MessagesList messages={messages} currentUserId={currentUserId} />
    </div>
  );
};

export default ChatWindow;

