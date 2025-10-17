import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Notification types
export const NOTIFICATION_TYPES = {
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  FRIEND_REQUEST_RECEIVED: 'FRIEND_REQUEST_RECEIVED',
  FRIEND_REQUEST_ACCEPTED: 'FRIEND_REQUEST_ACCEPTED',
  FRIEND_REQUEST_REJECTED: 'FRIEND_REQUEST_REJECTED',
  FRIEND_UNFRIENDED: 'FRIEND_UNFRIENDED'
};

// Notification actions
const ACTIONS = {
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  CLEAR_ALL_NOTIFICATIONS: 'CLEAR_ALL_NOTIFICATIONS',
  SET_BROWSER_PERMISSION: 'SET_BROWSER_PERMISSION'
};

// Initial state
const initialState = {
  notifications: [],
  browserPermission: 'default', // 'default', 'granted', 'denied'
  maxNotifications: 5 // Maximum number of notifications to keep in memory
};

// Reducer
const notificationReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.ADD_NOTIFICATION:
      const newNotification = {
        id: Date.now() + Math.random(),
        type: action.payload.type,
        title: action.payload.title,
        message: action.payload.message,
        senderName: action.payload.senderName,
        timestamp: new Date(),
        icon: action.payload.icon,
        color: action.payload.color,
        autoRemove: action.payload.autoRemove !== false // Default to true
      };

      // Add new notification and keep only the latest ones
      const updatedNotifications = [newNotification, ...state.notifications]
        .slice(0, state.maxNotifications);

      return {
        ...state,
        notifications: updatedNotifications
      };

    case ACTIONS.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(
          notification => notification.id !== action.payload
        )
      };

    case ACTIONS.CLEAR_ALL_NOTIFICATIONS:
      return {
        ...state,
        notifications: []
      };

    case ACTIONS.SET_BROWSER_PERMISSION:
      return {
        ...state,
        browserPermission: action.payload
      };

    default:
      return state;
  }
};

// Create context
const NotificationContext = createContext();

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  // Check browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      dispatch({
        type: ACTIONS.SET_BROWSER_PERMISSION,
        payload: Notification.permission
      });
    }
  }, []);

  // Request browser notification permission
  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      dispatch({
        type: ACTIONS.SET_BROWSER_PERMISSION,
        payload: permission
      });
      return permission === 'granted';
    }

    return false;
  };

  // Show browser notification
  const showBrowserNotification = (notification) => {
    if (state.browserPermission !== 'granted') {
      return;
    }

    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico', // App icon
        badge: '/favicon.ico',
        tag: notification.type, // Group notifications by type
        requireInteraction: false,
        silent: false
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        browserNotification.close();
      }, 5000);

      // Handle click to focus the app
      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
      };
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  };

  // Add notification (both in-app and browser)
  const addNotification = async (notificationData) => {
    console.log('🔔 NotificationContext: addNotification called with:', notificationData);
    
    // Determine notification styling based on type
    let icon, color, backgroundColor;
    switch (notificationData.type) {
      case NOTIFICATION_TYPES.MESSAGE_RECEIVED:
        icon = '💬';
        color = '#004D91'; // Primary blue
        backgroundColor = '#E3F2FD'; // Light blue background
        break;
      case NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED:
        icon = '📩';
        color = '#F4B400'; // Accent yellow
        backgroundColor = '#FFF8E1'; // Light yellow background
        break;
      case NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED:
        icon = '🤝';
        color = '#28a745'; // Success green
        backgroundColor = '#E8F5E8'; // Light green background
        break;
      case NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED:
        icon = '🚫';
        color = '#dc3545'; // Error red
        backgroundColor = '#FFEBEE'; // Light red background
        break;
      case NOTIFICATION_TYPES.FRIEND_UNFRIENDED:
        icon = '👋';
        color = '#6c757d'; // Neutral gray
        backgroundColor = '#F5F5F5'; // Light gray background
        break;
      default:
        icon = '🔔';
        color = '#004D91';
        backgroundColor = '#E3F2FD'; // Default light blue background
    }

    // Create notification object
    const notification = {
      ...notificationData,
      icon,
      color,
      backgroundColor
    };

    console.log('🔔 NotificationContext: Creating notification:', notification);

    // Add to in-app notifications
    dispatch({
      type: ACTIONS.ADD_NOTIFICATION,
      payload: notification
    });

    // Show browser notification if permission is granted
    if (state.browserPermission === 'granted') {
      console.log('🔔 NotificationContext: Showing browser notification');
      showBrowserNotification(notification);
    } else {
      console.log('🔔 NotificationContext: Browser permission not granted:', state.browserPermission);
    }

    // Auto-remove notification after 5 seconds if autoRemove is true
    if (notification.autoRemove) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, 5000);
    }
  };

  // Remove specific notification
  const removeNotification = (notificationId) => {
    dispatch({
      type: ACTIONS.REMOVE_NOTIFICATION,
      payload: notificationId
    });
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    dispatch({
      type: ACTIONS.CLEAR_ALL_NOTIFICATIONS
    });
  };

  // Convenience methods for different notification types
  const notifyMessageReceived = (senderName) => {
    console.log('🔔 NotificationContext: notifyMessageReceived called with:', senderName);
    addNotification({
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      title: 'New Message',
      message: `You received a new message from ${senderName}`,
      senderName
    });
  };

  const notifyFriendRequestReceived = (senderName) => {
    console.log('🔔 NotificationContext: notifyFriendRequestReceived called with:', senderName);
    addNotification({
      type: NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED,
      title: 'Friend Request',
      message: `New friend request from ${senderName}`,
      senderName
    });
  };

  const notifyFriendRequestAccepted = (senderName) => {
    console.log('🔔 NotificationContext: notifyFriendRequestAccepted called with:', senderName);
    addNotification({
      type: NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED,
      title: 'Friend Request Accepted',
      message: `${senderName} accepted your friend request`,
      senderName
    });
  };

  const notifyFriendRequestRejected = (senderName) => {
    console.log('🔔 NotificationContext: notifyFriendRequestRejected called with:', senderName);
    addNotification({
      type: NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED,
      title: 'Friend Request Rejected',
      message: `${senderName} rejected your friend request`,
      senderName
    });
  };

  const notifyFriendUnfriended = (senderName) => {
    console.log('🔔 NotificationContext: notifyFriendUnfriended called with:', senderName);
    addNotification({
      type: NOTIFICATION_TYPES.FRIEND_UNFRIENDED,
      title: 'Friend Removed',
      message: `${senderName} removed you from their friends list`,
      senderName
    });
  };

  const value = {
    notifications: state.notifications,
    browserPermission: state.browserPermission,
    addNotification,
    removeNotification,
    clearAllNotifications,
    requestBrowserPermission,
    // Convenience methods
    notifyMessageReceived,
    notifyFriendRequestReceived,
    notifyFriendRequestAccepted,
    notifyFriendRequestRejected,
    notifyFriendUnfriended
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
