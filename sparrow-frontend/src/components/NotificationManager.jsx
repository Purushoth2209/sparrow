import React, { useState, useRef, useEffect } from 'react';
import { useNotifications, NOTIFICATION_TYPES } from '../contexts/NotificationContext';
import { getNotificationSoundSettings, setNotificationSoundEnabled, setNotificationSoundVolume, testNotificationSound } from '../utils/notificationSound';
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
  const [soundSettings, setSoundSettings] = useState({ enabled: true, volume: 0.7 });
  const historyRef = useRef(null);
  const settingsRef = useRef(null);

  // Load sound settings on mount
  useEffect(() => {
    const settings = getNotificationSoundSettings();
    setSoundSettings(settings);
  }, []);

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
    // Close the panel after clicking
    setIsHistoryOpen(false);
  };

  const handleClearAll = () => {
    clearAll();
    setIsHistoryOpen(false);
    console.log('🗑️ All notifications cleared');
  };

  // Sound settings handlers
  const handleSoundToggle = (enabled) => {
    setNotificationSoundEnabled(enabled);
    setSoundSettings(prev => ({ ...prev, enabled }));
  };

  const handleVolumeChange = (volume) => {
    setNotificationSoundVolume(volume);
    setSoundSettings(prev => ({ ...prev, volume }));
  };

  const handleTestSound = () => {
    testNotificationSound('message_received');
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
            </div>
          </div>

          {/* Clear All Button - Prominently displayed */}
          {notifications.length > 0 && (
            <div className="notification-clear-all-section">
              <button
                className="clear-all-button"
                onClick={handleClearAll}
                title="Clear all notifications"
              >
                🗑️ Clear All
              </button>
            </div>
          )}

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                // Extract username and description for better layout
                const getNotificationContent = () => {
                  if (notification.type === NOTIFICATION_TYPES.MESSAGE_RECEIVED && notification.message.includes(':')) {
                    const parts = notification.message.split(':');
                    const username = parts[0].trim();
                    const description = parts.slice(1).join(':').trim();
                    return { username, description };
                  }
                  return { 
                    username: notification.username || 'Someone', 
                    description: notification.message 
                  };
                };

                const { username, description } = getNotificationContent();

                return (
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
                      <div className="notification-item-username">
                        {username}
                      </div>
                      <div className="notification-item-description">
                        {description}
                      </div>
                      <div className="notification-item-time">
                        {formatTime(notification.timestamp)}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="notification-item-unread-dot" />
                    )}
                  </div>
                );
              })
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

              <div className="setting-item">
                <label htmlFor="notification-sound">
                  Notification Sound
                </label>
                <div className="setting-control">
                  <input
                    id="notification-sound"
                    type="checkbox"
                    checked={soundSettings.enabled}
                    onChange={(e) => handleSoundToggle(e.target.checked)}
                  />
                  <span className="setting-description">
                    Play sound when receiving notifications
                  </span>
                </div>
              </div>

              {soundSettings.enabled && (
                <div className="setting-item">
                  <label htmlFor="sound-volume">
                    Sound Volume: {Math.round(soundSettings.volume * 100)}%
                  </label>
                  <div className="setting-control">
                    <input
                      id="sound-volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={soundSettings.volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="volume-slider"
                    />
                    <button
                      className="test-sound-button"
                      onClick={handleTestSound}
                      title="Test notification sound"
                    >
                      🔊 Test
                    </button>
                  </div>
                </div>
              )}

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

    </div>
  );
};

export default NotificationManager;
