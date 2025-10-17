import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, NOTIFICATION_TYPES } from '../contexts/NotificationContext';
import InAppNotification from './InAppNotification';
import './styles/NotificationManager.css';

const NotificationManager = () => {
  const {
    notifications,
    unreadCount,
    browserPermission,
    browserNotificationsEnabled,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    requestPermission,
    toggleBrowserNotifications
  } = useNotifications();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const historyRef = useRef(null);
  const settingsRef = useRef(null);

  // Close history/settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (historyRef.current && !historyRef.current.contains(event.target)) {
        setIsHistoryOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
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
    <div className="notification-manager">
      {/* Notification Bell Icon - Fixed position for global access */}
      <div className="notification-bell-container">
        <button
          className="notification-bell"
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          title="Notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification History Dropdown */}
      {isHistoryOpen && (
        <div className="notification-history" ref={historyRef}>
          <div className="notification-history-header">
            <h3>Notifications</h3>
            <div className="notification-actions">
              <button
                className="action-button"
                onClick={() => setIsSettingsOpen(true)}
                title="Settings"
              >
                ⚙️
              </button>
              {unreadCount > 0 && (
                <button
                  className="action-button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  ✓
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  className="action-button"
                  onClick={clearAll}
                  title="Clear all"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-item-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-item-content">
                    <div className="notification-item-title">
                      {notification.title}
                    </div>
                    <div className="notification-item-message">
                      {notification.message}
                    </div>
                    <div className="notification-item-time">
                      {formatTime(notification.timestamp)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="notification-item-unread-dot" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="notification-settings-overlay">
          <div className="notification-settings" ref={settingsRef}>
            <div className="settings-header">
              <h3>Notification Settings</h3>
              <button
                className="close-button"
                onClick={() => setIsSettingsOpen(false)}
              >
                ×
              </button>
            </div>
            
            <div className="settings-content">
              <div className="setting-item">
                <label htmlFor="browser-notifications">
                  Browser Notifications
                </label>
                <div className="setting-control">
                  <input
                    id="browser-notifications"
                    type="checkbox"
                    checked={browserNotificationsEnabled}
                    onChange={toggleBrowserNotifications}
                    disabled={browserPermission === 'denied'}
                  />
                  <span className="setting-description">
                    {browserPermission === 'denied' 
                      ? 'Browser notifications are blocked. Please enable them in your browser settings.'
                      : 'Show notifications even when the app is in another tab'
                    }
                  </span>
                </div>
              </div>

              {browserPermission === 'default' && (
                <div className="setting-item">
                  <button
                    className="permission-button"
                    onClick={requestPermission}
                  >
                    Request Notification Permission
                  </button>
                </div>
              )}

              <div className="settings-footer">
                <button
                  className="close-settings-button"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications Container */}
      <div className="toast-notifications-container">
        {notifications
          .filter(n => !n.read)
          .slice(0, 3) // Show max 3 toast notifications
          .map((notification) => (
            <InAppNotification
              key={notification.id}
              notification={notification}
              onRemove={removeNotification}
              onMarkAsRead={markAsRead}
            />
          ))
        }
      </div>
    </div>
  );
};

export default NotificationManager;
