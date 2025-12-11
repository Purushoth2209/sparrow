// Centralized Socket Event Handlers
// All socket.on() listeners should be registered here

export const createSocketHandlers = (socket, handlers) => {
  if (!socket) return () => {};

  const {
    onMessageReceived,
    onMessageSent,
    onMessageDelivered,
    onMessagesRead,
    onMessageStatusUpdate,
    onFriendRequestReceived,
    onFriendRequestAccepted,
    onFriendRequestRejected,
    onFriendUnfriended,
    onFriendOnlineStatus,
    onFriendsStatusSnapshot,
    onReconnect,
    onDisconnect,
    onConnectError,
  } = handlers;

  // Message handlers
  if (onMessageReceived) {
    socket.on('receiveMessage', onMessageReceived);
    socket.on('messageReceivedNotification', onMessageReceived);
  }

  if (onMessageSent) {
    socket.on('messageSent', onMessageSent);
  }

  if (onMessageDelivered) {
    socket.on('messageDelivered', onMessageDelivered);
  }

  if (onMessagesRead) {
    socket.on('messagesRead', onMessagesRead);
  }

  if (onMessageStatusUpdate) {
    socket.on('messageStatusUpdate', onMessageStatusUpdate);
  }

  // Friend request handlers
  if (onFriendRequestReceived) {
    socket.on('friend_request_received', onFriendRequestReceived);
    socket.on('friendRequestReceived', onFriendRequestReceived);
  }

  if (onFriendRequestAccepted) {
    socket.on('friendRequestAccepted', onFriendRequestAccepted);
  }

  if (onFriendRequestRejected) {
    socket.on('friendRequestRejected', onFriendRequestRejected);
  }

  if (onFriendUnfriended) {
    socket.on('friendUnfriended', onFriendUnfriended);
  }

  // Presence handlers
  if (onFriendOnlineStatus) {
    socket.on('friendOnlineStatus', onFriendOnlineStatus);
  }

  if (onFriendsStatusSnapshot) {
    socket.on('friendsStatusSnapshot', onFriendsStatusSnapshot);
  }

  // Connection handlers
  if (onReconnect) {
    socket.on('reconnect', onReconnect);
  }

  if (onDisconnect) {
    socket.on('disconnect', onDisconnect);
  }

  if (onConnectError) {
    socket.on('connect_error', onConnectError);
  }

  // Cleanup function
  return () => {
    if (onMessageReceived) {
      socket.off('receiveMessage', onMessageReceived);
      socket.off('messageReceivedNotification', onMessageReceived);
    }
    if (onMessageSent) socket.off('messageSent', onMessageSent);
    if (onMessageDelivered) socket.off('messageDelivered', onMessageDelivered);
    if (onMessagesRead) socket.off('messagesRead', onMessagesRead);
    if (onMessageStatusUpdate) socket.off('messageStatusUpdate', onMessageStatusUpdate);
    if (onFriendRequestReceived) {
      socket.off('friend_request_received', onFriendRequestReceived);
      socket.off('friendRequestReceived', onFriendRequestReceived);
    }
    if (onFriendRequestAccepted) socket.off('friendRequestAccepted', onFriendRequestAccepted);
    if (onFriendRequestRejected) socket.off('friendRequestRejected', onFriendRequestRejected);
    if (onFriendUnfriended) socket.off('friendUnfriended', onFriendUnfriended);
    if (onFriendOnlineStatus) socket.off('friendOnlineStatus', onFriendOnlineStatus);
    if (onFriendsStatusSnapshot) socket.off('friendsStatusSnapshot', onFriendsStatusSnapshot);
    if (onReconnect) socket.off('reconnect', onReconnect);
    if (onDisconnect) socket.off('disconnect', onDisconnect);
    if (onConnectError) socket.off('connect_error', onConnectError);
  };
};

// Helper to emit socket events
export const emitSocketEvent = (socket, event, data) => {
  if (socket && socket.connected) {
    socket.emit(event, data);
    return true;
  }
  return false;
};

