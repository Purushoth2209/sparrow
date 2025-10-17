import React, { useState, useEffect } from 'react';
import { NOTIFICATION_TYPES } from '../contexts/NotificationContext';

const InAppNotification = ({ notification, onRemove, onMarkAsRead }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss after 3.5 seconds (3-4 seconds as requested)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleRemove();
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onRemove(notification.id);
    }, 300); // Wait for animation to complete
  };

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    handleRemove();
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case NOTIFICATION_TYPES.MESSAGE_RECEIVED:
        return '💬';
      case NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED:
        return '👋';
      case NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED:
        return '✅';
      case NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED:
        return '❌';
      case NOTIFICATION_TYPES.FRIEND_UNFRIENDED:
        return '👥';
      default:
        return '🔔';
    }
  };

  // Format timestamp properly to avoid "Invalid Date"
  const formatTimestamp = (timestamp) => {
    try {
      // Handle different timestamp formats
      let date;
      
      if (typeof timestamp === 'string') {
        // If it's already a formatted time string, return as is
        if (timestamp.includes(':') && !timestamp.includes('Invalid')) {
          return timestamp;
        }
        // Try to parse as date
        date = new Date(timestamp);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        // Fallback to current time
        date = new Date();
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Format as DD MMM, hh:mm A (e.g., "17 Oct, 10:25 AM")
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('Error formatting timestamp:', error);
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  // Extract username and message content for better layout control
  const getNotificationContent = () => {
    if (notification.type === NOTIFICATION_TYPES.MESSAGE_RECEIVED && notification.message.includes(':')) {
      const parts = notification.message.split(':');
      const username = parts[0].trim();
      const messageContent = parts.slice(1).join(':').trim();
      return { username, messageContent };
    }
    return { username: notification.username || 'Someone', messageContent: notification.message };
  };

  const { username, messageContent } = getNotificationContent();

  return (
    <div
      className={`notification-card ${isVisible ? 'visible' : ''} ${isRemoving ? 'removing' : ''} ${notification.read ? 'read' : ''}`}
      onClick={handleClick}
    >
      <div className="notification-icon">
        {getNotificationIcon()}
      </div>
      <div className="notification-title">
        {notification.title}
      </div>
      <div className="notification-username">
        {username}
      </div>
      <div className="notification-bottom">
        <div className="notification-description">
          {messageContent}
        </div>
        <div className="notification-timestamp">
          {formatTimestamp(notification.timestamp)}
        </div>
      </div>
      <div className="notification-close" onClick={(e) => {
        e.stopPropagation();
        handleRemove();
      }}>
        ×
      </div>
      
      {/* Unread indicator */}
      {!notification.read && (
        <div className="unread-indicator" />
      )}
    </div>
  );
};

export default InAppNotification;
