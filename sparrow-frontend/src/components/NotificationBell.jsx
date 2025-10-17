import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { NOTIFICATION_TYPES } from '../contexts/NotificationContext';
import './styles/NotificationBell.css';

const NotificationBell = () => {
  const {
    notifications,
    unreadCount,
    removeNotification,
    markAsRead
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
  };

  const handleRemoveNotification = (e, notificationId) => {
    e.stopPropagation();
    removeNotification(notificationId);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
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

  const getNotificationTypeText = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.MESSAGE_RECEIVED:
        return 'sent you a message';
      case NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED:
        return 'sent you a friend request';
      case NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED:
        return 'accepted your friend request';
      case NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED:
        return 'rejected your friend request';
      case NOTIFICATION_TYPES.FRIEND_UNFRIENDED:
        return 'removed you as a friend';
      default:
        return 'notification';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
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
        return 'Just now';
      }
      
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) { // Less than 1 minute
        return 'Just now';
      } else if (diff < 3600000) { // Less than 1 hour
        return `${Math.floor(diff / 60000)}m ago`;
      } else if (diff < 86400000) { // Less than 1 day
        return `${Math.floor(diff / 3600000)}h ago`;
      } else {
        // Format as DD MMM, hh:mm A (e.g., "17 Oct, 10:25 AM")
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch (error) {
      console.warn('Error formatting timestamp:', error);
      return 'Just now';
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        className="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h6>Notifications</h6>
            <span className="notification-count">{notifications.length}</span>
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-sender">
                      {notification.username || 'Someone'}
                    </div>
                    <div className="notification-text">
                      {getNotificationTypeText(notification.type)}
                    </div>
                    <div className="notification-time">
                      {formatTime(notification.timestamp)}
                    </div>
                  </div>
                  <button
                    className="notification-remove"
                    onClick={(e) => handleRemoveNotification(e, notification.id)}
                    title="Remove notification"
                  >
                    ×
                  </button>
                  {!notification.read && (
                    <div className="notification-unread-dot" />
                  )}
                </div>
              ))
            )}
          </div>
          
          {notifications.length > 10 && (
            <div className="notification-footer">
              <small>Showing 10 of {notifications.length} notifications</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
