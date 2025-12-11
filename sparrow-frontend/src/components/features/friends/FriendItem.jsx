import React from 'react';
import { Badge } from 'react-bootstrap';

const FriendItem = ({ friend, isActive, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`friend-item d-flex justify-content-between align-items-center ${
        isActive ? 'active' : ''
      }`}
    >
      <div className="d-flex align-items-center">
        <div className="me-3">
          {friend.profileImage ? (
            <img
              src={friend.profileImage}
              alt={friend.username}
              className="friend-avatar"
              style={{ width: '48px', height: '48px', objectFit: 'cover' }}
            />
          ) : (
            <div
              className="friend-avatar d-flex align-items-center justify-content-center"
              style={{
                width: '48px',
                height: '48px',
                fontSize: '18px',
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
          <div className="friend-name">{friend.username}</div>
          <div className="friend-status">
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
          </div>
        </div>
      </div>
      {friend.unreadMessages > 0 && (
        <Badge className="badge-modern" style={{ background: 'var(--error-color)' }}>
          {friend.unreadMessages}
        </Badge>
      )}
    </div>
  );
};

export default FriendItem;

