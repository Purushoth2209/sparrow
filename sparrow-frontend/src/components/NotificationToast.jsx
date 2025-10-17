import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import './styles/modern-theme.css';

const NotificationToast = ({ notification }) => {
  const { removeNotification } = useNotifications();

  const handleClose = () => {
    removeNotification(notification.id);
  };

  // Function to calculate contrast and determine appropriate text color
  const getContrastColor = (backgroundColor, lightColor = '#ffffff', darkColor = '#000000') => {
    // Convert hex to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    // Calculate relative luminance
    const getLuminance = (r, g, b) => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    // Get background color (default to notification color if no specific background)
    const bgColor = notification.backgroundColor || notification.color;
    const rgb = hexToRgb(bgColor);
    
    if (!rgb) return darkColor;
    
    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    
    // Return light text for dark backgrounds, dark text for light backgrounds
    return luminance > 0.5 ? darkColor : lightColor;
  };

  const getNotificationStyle = () => {
    const backgroundColor = notification.backgroundColor || 'var(--bg-primary)';
    const textColor = getContrastColor(backgroundColor);
    
    return {
      backgroundColor,
      borderLeft: `4px solid ${notification.color}`,
      boxShadow: 'var(--shadow-lg)',
      border: '1px solid var(--border-light)',
      color: textColor
    };
  };

  const getIconStyle = () => {
    const backgroundColor = `${notification.color}20`; // 20% opacity
    const textColor = getContrastColor(backgroundColor);
    
    return {
      backgroundColor,
      color: notification.color
    };
  };

  const getTextStyle = () => {
    const backgroundColor = notification.backgroundColor || 'var(--bg-primary)';
    const textColor = getContrastColor(backgroundColor);
    
    return {
      color: textColor
    };
  };

  return (
    <div 
      className="notification-toast"
      style={getNotificationStyle()}
      role="alert"
      aria-live="polite"
    >
      <div className="notification-content">
        <div className="notification-icon" style={getIconStyle()}>
          {notification.icon}
        </div>
        
        <div className="notification-text" style={getTextStyle()}>
          <div className="notification-title">
            {notification.title}
          </div>
          <div className="notification-message">
            {notification.message}
          </div>
          <div className="notification-time">
            {formatTime(notification.timestamp)}
          </div>
        </div>
        
        <button
          className="notification-close"
          onClick={handleClose}
          aria-label="Close notification"
          title="Close"
        >
          ×
        </button>
      </div>
      
      {/* Progress bar for auto-removal */}
      {notification.autoRemove && (
        <div className="notification-progress">
          <div 
            className="notification-progress-bar"
            style={{ 
              backgroundColor: notification.color,
              animation: 'notificationProgress 5s linear forwards'
            }}
          />
        </div>
      )}
    </div>
  );
};

const formatTime = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ago`;
  } else {
    return time.toLocaleDateString();
  }
};

export default NotificationToast;
