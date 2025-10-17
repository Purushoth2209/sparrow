import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';

const NotificationContext = createContext();

// Notification types
export const NOTIFICATION_TYPES = {
  MESSAGE_RECEIVED: 'message_received',
  FRIEND_REQUEST_RECEIVED: 'friend_request_received',
  FRIEND_REQUEST_ACCEPTED: 'friend_request_accepted',
  FRIEND_REQUEST_REJECTED: 'friend_request_rejected',
  FRIEND_UNFRIENDED: 'friend_unfriended'
};

// Load notifications from localStorage
const loadNotificationsFromStorage = () => {
  try {
    const saved = localStorage.getItem('sparrow_notifications');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        notifications: parsed.notifications || [],
        unreadCount: parsed.unreadCount || 0
      };
    }
  } catch (error) {
    console.warn('Failed to load notifications from localStorage:', error);
  }
  return { notifications: [], unreadCount: 0 };
};

// Save notifications to localStorage
const saveNotificationsToStorage = (notifications, unreadCount) => {
  try {
    localStorage.setItem('sparrow_notifications', JSON.stringify({
      notifications,
      unreadCount
    }));
  } catch (error) {
    console.warn('Failed to save notifications to localStorage:', error);
  }
};

// Notification reducer
const notificationReducer = (state, action) => {
  let newState;
  
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      newState = {
        ...state,
        notifications: [action.payload, ...state.notifications.slice(0, 49)], // Keep last 50
        unreadCount: state.unreadCount + 1
      };
      break;
    
    case 'REMOVE_NOTIFICATION':
      newState = {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
        unreadCount: Math.max(0, state.unreadCount - 1)
      };
      break;
    
    case 'MARK_AS_READ':
      newState = {
        ...state,
        notifications: state.notifications.map(n => 
          n.id === action.payload ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      };
      break;
    
    case 'MARK_ALL_AS_READ':
      newState = {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
      };
      break;
    
    case 'CLEAR_ALL':
      newState = {
        ...state,
        notifications: [],
        unreadCount: 0
      };
      break;
    
    case 'LOAD_NOTIFICATIONS':
      newState = {
        ...state,
        notifications: action.payload.notifications,
        unreadCount: action.payload.unreadCount
      };
      break;
    
    case 'SET_BROWSER_PERMISSION':
      newState = {
        ...state,
        browserPermission: action.payload
      };
      break;
    
    case 'TOGGLE_BROWSER_NOTIFICATIONS':
      newState = {
        ...state,
        browserNotificationsEnabled: action.payload
      };
      break;
    
    default:
      return state;
  }
  
  // Save to localStorage whenever notifications change
  if (action.type.startsWith('ADD_') || action.type.startsWith('REMOVE_') || 
      action.type.startsWith('MARK_') || action.type.startsWith('CLEAR_') || 
      action.type === 'LOAD_NOTIFICATIONS') {
    saveNotificationsToStorage(newState.notifications, newState.unreadCount);
  }
  
  return newState;
};

// Browser notification utility functions
const requestBrowserNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

const createBrowserNotification = (notification) => {
  // Check if Notification API is supported
  if (!('Notification' in window)) {
    console.warn('⚠️ Browser notifications are not supported in this browser');
    return null;
  }
  
  // Handle different permission states
  if (Notification.permission === 'denied') {
    console.warn('⚠️ Browser notification permission denied. In-app notifications will continue to work normally.');
    return null;
  }
  
  if (Notification.permission !== 'granted') {
    console.log('ℹ️ Browser notification permission not granted yet');
    return null;
  }
  
  // Check if the app is currently focused
  const isAppFocused = !document.hidden && document.hasFocus();
  
  // Only show browser notification if app is not focused
  if (isAppFocused) {
    console.log('📱 App is focused, skipping browser notification');
    return null;
  }
  
  // Create a better browser notification message
  let browserMessage = notification.message;
  let browserTitle = notification.title;
  
  // Customize messages for better browser notification experience
  switch (notification.type) {
    case NOTIFICATION_TYPES.MESSAGE_RECEIVED:
      browserTitle = `New message from ${notification.username || 'Someone'}`;
      // Extract just the message preview from the notification message
      browserMessage = notification.message.includes(':') 
        ? notification.message.split(':').slice(1).join(':').trim()
        : notification.message;
      break;
    case NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED:
      browserTitle = 'Sparrow Chat';
      browserMessage = `${notification.username} sent you a friend request`;
      break;
    case NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED:
      browserTitle = 'Sparrow Chat';
      browserMessage = `${notification.username} accepted your friend request`;
      break;
    case NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED:
      browserTitle = 'Sparrow Chat';
      browserMessage = `${notification.username} rejected your friend request`;
      break;
    case NOTIFICATION_TYPES.FRIEND_UNFRIENDED:
      browserTitle = 'Sparrow Chat';
      browserMessage = `${notification.username} removed you as a friend`;
      break;
  }
  
  const options = {
    body: browserMessage,
    icon: notification.senderProfileImage || '/favicon.ico',
    badge: '/favicon.ico',
    tag: notification.type, // Group notifications by type
    requireInteraction: false,
    silent: false,
    data: {
      senderId: notification.senderId,
      messageId: notification.messageId,
      type: notification.type
    }
  };
  
  try {
    const browserNotification = new Notification(browserTitle, options);
    
    // Handle notification click - focus the app and potentially navigate to chat
    browserNotification.onclick = () => {
      console.log('🔔 Browser notification clicked:', notification);
      
      // Focus the window
      window.focus();
      
      // Close the notification
      browserNotification.close();
      
      // If it's a message notification, we could potentially navigate to the chat
      // For now, just focus the app
      if (notification.type === NOTIFICATION_TYPES.MESSAGE_RECEIVED) {
        console.log('💬 Message notification clicked, focusing app');
        // The app will handle showing the message in the UI
      }
    };
    
    // Auto-close after 8 seconds (longer for browser notifications)
    setTimeout(() => {
      browserNotification.close();
    }, 8000);
    
    return browserNotification;
  } catch (error) {
    console.error('❌ Error creating browser notification:', error);
    return null;
  }
};

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const { socket } = useSocket();
  
  // Load initial state from localStorage
  const initialNotifications = loadNotificationsFromStorage();
  
  const [state, dispatch] = useReducer(notificationReducer, {
    notifications: initialNotifications.notifications,
    unreadCount: initialNotifications.unreadCount,
    browserPermission: 'default',
    browserNotificationsEnabled: false
  });

  // Check browser notification permission on mount and request permission
  useEffect(() => {
    if ('Notification' in window) {
      dispatch({ type: 'SET_BROWSER_PERMISSION', payload: Notification.permission });
      
      // Load saved browser notification preference
      const savedPreference = localStorage.getItem('browserNotificationsEnabled');
      if (savedPreference !== null) {
        dispatch({ 
          type: 'TOGGLE_BROWSER_NOTIFICATIONS', 
          payload: savedPreference === 'true' 
        });
      }
      
      // Request permission when app loads if not already granted or denied
      if (Notification.permission === 'default') {
        console.log('🔔 Requesting browser notification permission...');
        requestBrowserNotificationPermission().then((permission) => {
          dispatch({ type: 'SET_BROWSER_PERMISSION', payload: permission });
          if (permission === 'granted') {
            dispatch({ type: 'TOGGLE_BROWSER_NOTIFICATIONS', payload: true });
            console.log('✅ Browser notification permission granted');
          } else if (permission === 'denied') {
            console.warn('⚠️ Browser notification permission denied by user');
            dispatch({ type: 'TOGGLE_BROWSER_NOTIFICATIONS', payload: false });
          }
        });
      } else if (Notification.permission === 'granted') {
        console.log('✅ Browser notification permission already granted');
        dispatch({ type: 'TOGGLE_BROWSER_NOTIFICATIONS', payload: true });
      } else if (Notification.permission === 'denied') {
        console.warn('⚠️ Browser notification permission was previously denied');
        dispatch({ type: 'TOGGLE_BROWSER_NOTIFICATIONS', payload: false });
      }
    } else {
      console.warn('⚠️ Browser notifications are not supported in this browser');
    }
  }, []);

  // Save browser notification preference to localStorage
  useEffect(() => {
    localStorage.setItem('browserNotificationsEnabled', state.browserNotificationsEnabled.toString());
  }, [state.browserNotificationsEnabled]);

  // Add notification function - Enhanced for dual display
  const addNotification = useCallback((notificationData) => {
    const notification = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      read: false,
      ...notificationData
    };
    
    console.log('🔔 Adding notification:', {
      type: notification.type,
      title: notification.title,
      username: notification.username,
      message: notification.message
    });
    
    // Always add to persistent panel
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    
    // Show browser notification if enabled
    if (state.browserNotificationsEnabled && state.browserPermission === 'granted') {
      createBrowserNotification(notification);
    }
    
    console.log('🔔 Dual notification added successfully:', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      username: notification.username,
      message: notification.message,
      timestamp: notification.timestamp,
      willShowAsToast: true,
      willShowInPanel: true
    });
    
    return notification;
  }, [state.browserNotificationsEnabled, state.browserPermission]);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    const permission = await requestBrowserNotificationPermission();
    dispatch({ type: 'SET_BROWSER_PERMISSION', payload: permission });
    return permission;
  }, []);

  // Toggle browser notifications
  const toggleBrowserNotifications = useCallback(async () => {
    if (!state.browserNotificationsEnabled) {
      // Enable browser notifications - request permission first
      const permission = await requestPermission();
      if (permission === 'granted') {
        dispatch({ type: 'TOGGLE_BROWSER_NOTIFICATIONS', payload: true });
      } else {
        dispatch({ type: 'TOGGLE_BROWSER_NOTIFICATIONS', payload: false });
      }
    } else {
      // Disable browser notifications
      dispatch({ type: 'TOGGLE_BROWSER_NOTIFICATIONS', payload: false });
    }
  }, [state.browserNotificationsEnabled, requestPermission]);

  // API functions for friend-related notifications
  const notifyFriendRequestReceived = useCallback((requestData) => {
    addNotification({
      type: NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED,
      title: 'Friend Request',
      message: `${requestData.username} sent you a friend request`,
      username: requestData.username,
      senderId: requestData.fromUserId,
      data: requestData
    });
  }, [addNotification]);

  const notifyFriendRequestAccepted = useCallback((requestData) => {
    addNotification({
      type: NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED,
      title: 'Friend Request Accepted',
      message: `${requestData.username} accepted your friend request`,
      username: requestData.username,
      senderId: requestData.fromUserId,
      data: requestData
    });
  }, [addNotification]);

  const notifyFriendRequestRejected = useCallback((requestData) => {
    addNotification({
      type: NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED,
      title: 'Friend Request Rejected',
      message: `${requestData.username} rejected your friend request`,
      username: requestData.username,
      senderId: requestData.fromUserId,
      data: requestData
    });
  }, [addNotification]);

  const notifyFriendUnfriended = useCallback((requestData) => {
    addNotification({
      type: NOTIFICATION_TYPES.FRIEND_UNFRIENDED,
      title: 'Friend Removed',
      message: `${requestData.username} removed you as a friend`,
      username: requestData.username,
      senderId: requestData.fromUserId,
      data: requestData
    });
  }, [addNotification]);

  // Socket event listeners - ensure they're always active
  useEffect(() => {
    if (!socket) return;

    // Track processed notifications to prevent duplicates
    const processedNotifications = new Set();

    // Handle the new messageReceivedNotification event - this fires 100% reliably
    const handleMessageReceivedNotification = (notificationData) => {
      console.log('🔔 messageReceivedNotification event received:', notificationData);
      
      // Only show notification if message is not from current user
      const currentUserId = localStorage.getItem('profileId');
      if (notificationData.senderId !== currentUserId) {
        // Create unique key for duplicate prevention
        const notificationKey = `${notificationData.messageId}-${notificationData.senderId}`;
        
        // Prevent duplicate notifications
        if (processedNotifications.has(notificationKey)) {
          console.log('⚠️ Duplicate notification prevented:', notificationKey);
          return;
        }
        
        // Mark as processed
        processedNotifications.add(notificationKey);
        
        // Clean up old processed notifications (keep last 100)
        if (processedNotifications.size > 100) {
          const oldKeys = Array.from(processedNotifications).slice(0, 50);
          oldKeys.forEach(key => processedNotifications.delete(key));
        }
        
        // Create notification with proper formatting
        const notification = {
          type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
          title: 'New Message',
          message: `${notificationData.senderName}: ${notificationData.messagePreview}`,
          username: notificationData.senderName,
          senderId: notificationData.senderId,
          senderProfileImage: notificationData.senderProfileImage,
          timestamp: new Date(notificationData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          data: notificationData,
          messageId: notificationData.messageId
        };
        
        console.log('🔔 Adding message notification:', notification);
        addNotification(notification);
      }
    };

    // Keep the old handler for backward compatibility but prioritize the new one
    const handleMessageReceived = (messageData) => {
      console.log('📨 Message received notification triggered (legacy):', messageData);
      
      // Only show notification if message is not from current user
      const currentUserId = localStorage.getItem('profileId');
      if (messageData.senderId !== currentUserId) {
        // Create unique key for duplicate prevention
        const notificationKey = `${messageData._id || Date.now()}-${messageData.senderId}`;
        
        // Prevent duplicate notifications
        if (processedNotifications.has(notificationKey)) {
          console.log('⚠️ Duplicate legacy notification prevented:', notificationKey);
          return;
        }
        
        // Mark as processed
        processedNotifications.add(notificationKey);
        
        // Get first few words of message content
        const messagePreview = messageData.content 
          ? messageData.content.substring(0, 50) + (messageData.content.length > 50 ? '...' : '')
          : 'a message';
        
        // Always trigger notification - no conditions that could skip it
        const notificationData = {
          type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
          title: 'New Message',
          message: `${messageData.senderUsername || 'Someone'}: ${messagePreview}`,
          username: messageData.senderUsername,
          senderId: messageData.senderId,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          data: messageData
        };
        
        console.log('🔔 Adding legacy message notification:', notificationData);
        addNotification(notificationData);
      }
    };

    const handleFriendRequestReceived = (requestData) => {
      console.log('👋 Friend request received:', requestData);
      notifyFriendRequestReceived(requestData);
    };

    const handleFriendRequestAccepted = (requestData) => {
      console.log('✅ Friend request accepted:', requestData);
      notifyFriendRequestAccepted(requestData);
    };

    const handleFriendRequestRejected = (requestData) => {
      console.log('❌ Friend request rejected:', requestData);
      notifyFriendRequestRejected(requestData);
    };

    const handleFriendUnfriended = (requestData) => {
      console.log('👥 Friend unfriended:', requestData);
      notifyFriendUnfriended(requestData);
    };

    console.log('🔧 Setting up notification socket listeners');
    
    // Remove any existing listeners first to prevent duplicates
    socket.off('messageReceivedNotification', handleMessageReceivedNotification);
    socket.off('receiveMessage', handleMessageReceived);
    socket.off('friendRequestReceived', handleFriendRequestReceived);
    socket.off('friendRequestAccepted', handleFriendRequestAccepted);
    socket.off('friendRequestRejected', handleFriendRequestRejected);
    socket.off('friendUnfriended', handleFriendUnfriended);
    
    // Add socket event listeners - prioritize the new notification event
    socket.on('messageReceivedNotification', handleMessageReceivedNotification);
    socket.on('receiveMessage', handleMessageReceived);
    socket.on('friendRequestReceived', handleFriendRequestReceived);
    socket.on('friendRequestAccepted', handleFriendRequestAccepted);
    socket.on('friendRequestRejected', handleFriendRequestRejected);
    socket.on('friendUnfriended', handleFriendUnfriended);

    // Cleanup listeners
    return () => {
      console.log('🧹 Cleaning up notification socket listeners');
      socket.off('messageReceivedNotification', handleMessageReceivedNotification);
      socket.off('receiveMessage', handleMessageReceived);
      socket.off('friendRequestReceived', handleFriendRequestReceived);
      socket.off('friendRequestAccepted', handleFriendRequestAccepted);
      socket.off('friendRequestRejected', handleFriendRequestRejected);
      socket.off('friendUnfriended', handleFriendUnfriended);
    };
  }, [socket, addNotification, notifyFriendRequestReceived, notifyFriendRequestAccepted, notifyFriendRequestRejected, notifyFriendUnfriended]);

  // Utility functions
  const removeNotification = useCallback((id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const markAsRead = useCallback((id) => {
    dispatch({ type: 'MARK_AS_READ', payload: id });
  }, []);

  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_AS_READ' });
  }, []);

  const clearAll = useCallback(() => {
    console.log('🗑️ Clearing all notifications');
    dispatch({ type: 'CLEAR_ALL' });
    
    // Also clear any pending browser notifications
    if ('Notification' in window) {
      // Close any open browser notifications
      // Note: Browser notifications can't be programmatically closed in all browsers
      // but this ensures we clear the local state
    }
  }, []);

  const value = {
    // State
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    browserPermission: state.browserPermission,
    browserNotificationsEnabled: state.browserNotificationsEnabled,
    
    // Actions
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    requestPermission,
    toggleBrowserNotifications,
    
    // Friend notification helpers
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

// Hook to use notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
