import React from 'react';
import { Badge } from 'react-bootstrap';

/**
 * ConversationItem Component
 * Displays a single conversation in the conversation list
 */
const ConversationItem = ({ 
  conversation, 
  isActive, 
  onClick 
}) => {
  const { participant, lastMessagePreview, lastMessageTimestamp, unreadCount } = conversation;

  if (!participant) {
    return null;
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`conversation-item d-flex justify-content-between align-items-center ${
        isActive ? 'active' : ''
      }`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="d-flex align-items-center flex-grow-1">
        <div className="me-3">
          {participant.profileImage ? (
            <img
              src={participant.profileImage}
              alt={participant.username}
              className="conversation-avatar"
              style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%',
                objectFit: 'cover' 
              }}
            />
          ) : (
            <div
              className="conversation-avatar d-flex align-items-center justify-content-center"
              style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%',
                fontSize: '18px',
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%)',
                color: 'white',
                fontWeight: '600'
              }}
            >
              {participant.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex justify-content-between align-items-center">
            <div className="conversation-name" style={{ fontWeight: unreadCount > 0 ? '600' : '400' }}>
              {participant.username}
            </div>
            {lastMessageTimestamp && (
              <div className="conversation-time" style={{ fontSize: '0.85rem', color: '#666' }}>
                {formatTimestamp(lastMessageTimestamp)}
              </div>
            )}
          </div>
          <div className="conversation-preview" style={{ 
            fontSize: '0.9rem', 
            color: '#666',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {lastMessagePreview || 'No messages yet'}
          </div>
          {participant.isOnline && (
            <span className="status-online ms-1" style={{ fontSize: '0.75rem' }}>
              <span className="online-indicator"></span>
              Online
            </span>
          )}
        </div>
      </div>
      {unreadCount > 0 && (
        <Badge 
          className="badge-modern ms-2" 
          style={{ 
            background: 'var(--error-color)',
            minWidth: '20px'
          }}
        >
          {unreadCount}
        </Badge>
      )}
    </div>
  );
};

export default ConversationItem;

