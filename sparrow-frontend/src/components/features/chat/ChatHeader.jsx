import React from 'react';
import { Button } from 'react-bootstrap';

const ChatHeader = ({ friend, onCloseChat, onRemoveFriend, showBackButton = false }) => {
  return (
    <div className="chat-header">
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          {/* Back Button for Mobile */}
          {showBackButton && (
            <Button
              className="btn-modern-icon me-2 d-md-none"
              onClick={onCloseChat}
              title="Back to friends list"
            >
              ←
            </Button>
          )}
          <div className="me-3">
            {friend.profileImage ? (
              <img
                src={friend.profileImage}
                alt={friend.username}
                className="friend-avatar"
                style={{ width: '40px', height: '40px', objectFit: 'cover' }}
              />
            ) : (
              <div
                className="friend-avatar d-flex align-items-center justify-content-center"
                style={{
                  width: '40px',
                  height: '40px',
                  fontSize: '16px',
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%)',
                  color: 'white',
                  fontWeight: '600'
                }}
              >
                {friend.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h5 className="mb-0 friend-name">{friend.username}</h5>
            <small className="friend-status">
              {friend.fullName || friend.username}
              {friend.isOnline ? (
                <span className="status-online ms-1">
                  <span className="online-indicator"></span>
                  Online
                </span>
              ) : (
                <span className="status-offline ms-1">
                  Last seen: {friend.lastSeen ? new Date(friend.lastSeen).toLocaleString() : 'Unknown'}
                </span>
              )}
            </small>
          </div>
        </div>
        <div className="d-flex align-items-center">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => onRemoveFriend(friend)}
            title="Remove friend"
            className="me-2 d-none d-md-inline-flex"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid var(--brand-primary)',
              color: 'var(--brand-primary)'
            }}
          >
            Remove Friend
          </Button>
          <Button
            className="btn-modern-icon d-none d-md-flex"
            onClick={onCloseChat}
            title="Close chat (Escape)"
          >
            ✕
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;

