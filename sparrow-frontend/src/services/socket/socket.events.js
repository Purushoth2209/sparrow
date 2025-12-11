// Socket event handlers and utilities
// This file centralizes socket event handling logic

export const socketEvents = {
  // Message events
  MESSAGE_RECEIVED: 'receiveMessage',
  MESSAGE_SENT: 'messageSent',
  MESSAGE_DELIVERED: 'messageDelivered',
  MESSAGES_READ: 'messagesRead',
  MESSAGE_STATUS_UPDATE: 'messageStatusUpdate',
  MESSAGE_RECEIVED_NOTIFICATION: 'messageReceivedNotification',

  // Friend events
  FRIEND_ONLINE_STATUS: 'friendOnlineStatus',
  FRIENDS_STATUS_SNAPSHOT: 'friendsStatusSnapshot',
  FRIEND_REQUEST_RECEIVED: 'friend_request_received',
  FRIEND_REQUEST_ACCEPTED: 'friendRequestAccepted',
  FRIEND_REQUEST_REJECTED: 'friendRequestRejected',
  FRIEND_UNFRIENDED: 'friendUnfriended',

  // Connection events
  REGISTER: 'register',
  LOGOUT: 'logout',
  PING: 'ping',
  PONG: 'pong',
};

export const emitSocketEvent = (socket, event, data) => {
  if (socket && socket.connected) {
    socket.emit(event, data);
  } else {
    console.warn(`Socket not connected, cannot emit ${event}`);
  }
};

