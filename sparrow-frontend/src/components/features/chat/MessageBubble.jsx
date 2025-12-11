import React from 'react';
import MessageStatus from '../../common/MessageStatus';
import { formatMessageTime } from '../../../shared/utils';

const MessageBubble = ({ message, currentUserId }) => {
  const isOwnMessage = message.senderId === currentUserId;

  return (
    <div
      className={`d-flex ${isOwnMessage ? 'justify-content-end' : 'justify-content-start'} mb-3`}
    >
      <div
        className={`message-bubble ${
          isOwnMessage ? 'message-sent' : 'message-received'
        }`}
      >
        <div className="message-content">{message.content}</div>
        <div className="message-time">
          <span>{formatMessageTime(message.timestamp)}</span>
          {isOwnMessage && (
            <MessageStatus status={message.status} timestamp={message.timestamp} />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;

