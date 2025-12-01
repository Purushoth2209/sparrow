/**
 * Socket Events Constants
 * Centralized event name definitions for Socket.IO
 */

module.exports = {
  // Connection events
  REGISTER: 'register',
  DISCONNECT: 'disconnect',
  PING: 'ping',
  PONG: 'pong',
  
  // Message events
  SEND_MESSAGE: 'sendMessage',
  RECEIVE_MESSAGE: 'receiveMessage',
  MESSAGE_SENT: 'messageSent',
  MESSAGE_DELIVERED: 'messageDelivered',
  MESSAGE_STATUS_UPDATE: 'messageStatusUpdate',
  MARK_MESSAGES_AS_READ: 'markMessagesAsRead',
  MESSAGES_READ: 'messagesRead',
  MESSAGE_RECEIVED_NOTIFICATION: 'messageReceivedNotification',
  
  // Presence events
  FRIEND_ONLINE_STATUS: 'friendOnlineStatus',
  FRIENDS_STATUS_SNAPSHOT: 'friendsStatusSnapshot',
  
  // Friend events
  FRIEND_REQUEST_RECEIVED: 'friendRequestReceived',
  FRIEND_REQUEST_ACCEPTED: 'friendRequestAccepted',
  FRIEND_REQUEST_REJECTED: 'friendRequestRejected',
  FRIEND_UNFRIENDED: 'friendUnfriended',
  
  // Logout
  LOGOUT: 'logout',
  
  // Error
  ERROR: 'error'
};

