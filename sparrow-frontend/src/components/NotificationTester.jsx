import React from 'react';
import { useNotifications, NOTIFICATION_TYPES } from '../contexts/NotificationContext';

const NotificationTester = () => {
  const { addNotification } = useNotifications();

  const testNotification = (type) => {
    const testData = {
      [NOTIFICATION_TYPES.MESSAGE_RECEIVED]: {
        type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
        title: 'New Message',
        message: 'John Doe: Hey! How are you doing today? This is a test message...',
        username: 'John Doe',
        senderId: 'test-sender-1',
        content: 'Hey! How are you doing today? This is a test message to see how the notification system handles longer message content.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      [NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED]: {
        type: NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED,
        title: 'Friend Request',
        message: 'Jane Smith sent you a friend request',
        username: 'Jane Smith',
        senderId: 'test-sender-2',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      [NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED]: {
        type: NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED,
        title: 'Friend Request Accepted',
        message: 'Bob Johnson accepted your friend request',
        username: 'Bob Johnson',
        senderId: 'test-sender-3',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      [NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED]: {
        type: NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED,
        title: 'Friend Request Rejected',
        message: 'Alice Brown rejected your friend request',
        username: 'Alice Brown',
        senderId: 'test-sender-4',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      [NOTIFICATION_TYPES.FRIEND_UNFRIENDED]: {
        type: NOTIFICATION_TYPES.FRIEND_UNFRIENDED,
        title: 'Friend Removed',
        message: 'Charlie Wilson removed you as a friend',
        username: 'Charlie Wilson',
        senderId: 'test-sender-5',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    };

    addNotification(testData[type]);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      left: '20px', 
      background: 'white', 
      padding: '20px', 
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 10000
    }}>
      <h3>Notification Tester</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button onClick={() => testNotification(NOTIFICATION_TYPES.MESSAGE_RECEIVED)}>
          Test Message Notification
        </button>
        <button onClick={() => testNotification(NOTIFICATION_TYPES.FRIEND_REQUEST_RECEIVED)}>
          Test Friend Request Received
        </button>
        <button onClick={() => testNotification(NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED)}>
          Test Friend Request Accepted
        </button>
        <button onClick={() => testNotification(NOTIFICATION_TYPES.FRIEND_REQUEST_REJECTED)}>
          Test Friend Request Rejected
        </button>
        <button onClick={() => testNotification(NOTIFICATION_TYPES.FRIEND_UNFRIENDED)}>
          Test Friend Unfriended
        </button>
      </div>
    </div>
  );
};

export default NotificationTester;
