import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import NotificationToast from './NotificationToast';
import './styles/modern-theme.css';

const NotificationContainer = () => {
  const { notifications, clearAllNotifications, browserPermission, requestBrowserPermission } = useNotifications();

  const handleRequestPermission = async () => {
    await requestBrowserPermission();
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container">
      {/* Permission request banner */}
      {browserPermission !== 'granted' && (
        <div className="notification-permission-banner">
          <div className="permission-content">
            <div className="permission-text">
              <strong>🔔 Enable notifications</strong>
              <span>Get notified about new messages and friend requests</span>
            </div>
            <button
              className="permission-btn"
              onClick={handleRequestPermission}
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {/* Clear all button */}
      {notifications.length > 1 && (
        <div className="notification-actions">
          <button
            className="clear-all-btn"
            onClick={clearAllNotifications}
            title="Clear all notifications"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Notifications */}
      <div className="notification-list">
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationContainer;
