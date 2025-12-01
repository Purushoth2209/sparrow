const User = require('../../models/User');

/**
 * Connection Handler
 * Handles socket connection, registration, and disconnection
 */

const userSockets = new Map(); // profileId -> socketId
const userLastPing = new Map(); // Track last ping time for each user
const onlineUsers = new Map(); // profileId -> { isOnline: true, lastSeen: Date, socketId: string }

// Helper functions for managing online users
const addOnlineUser = (profileId, socketId) => {
  onlineUsers.set(profileId, {
    isOnline: true,
    lastSeen: new Date(),
    socketId: socketId
  });
  console.log(`✅ Added user ${profileId} to online map`);
};

const removeOnlineUser = (profileId) => {
  onlineUsers.delete(profileId);
  console.log(`❌ Removed user ${profileId} from online map`);
};

const isUserOnline = (profileId) => {
  return onlineUsers.has(profileId);
};

const getOnlineUsersSnapshot = (friendIds) => {
  const snapshot = [];
  friendIds.forEach(friendId => {
    const onlineData = onlineUsers.get(friendId);
    snapshot.push({
      profileId: friendId,
      isOnline: !!onlineData,
      lastSeen: onlineData ? onlineData.lastSeen : null
    });
  });
  return snapshot;
};

/**
 * Handle socket registration
 */
const handleRegister = async (socket, io, profileId) => {
  console.log(`🔗 User ${profileId} connecting with socket ${socket.id}`);
  console.log(`🔍 DEBUG: Socket registration - Before registration userSockets map:`, Array.from(userSockets.entries()));
  
  // Check if user was already online (idempotent handling)
  const wasAlreadyOnline = isUserOnline(profileId);
  
  // Remove any existing socket for this user (handle reconnection)
  for (let [existingProfileId, existingSocketId] of userSockets) {
    if (existingProfileId === profileId) {
      console.log(`🔄 Removing existing socket for user ${profileId}`);
      userSockets.delete(existingProfileId);
      removeOnlineUser(existingProfileId);
      break;
    }
  }
  
  // Add to tracking maps
  userSockets.set(profileId, socket.id);
  userLastPing.set(profileId, Date.now());
  addOnlineUser(profileId, socket.id);
  
  console.log(`✅ User ${profileId} registered with socket ${socket.id}`);
  console.log(`🔍 DEBUG: Socket registration - userSockets map after registration:`, Array.from(userSockets.entries()));
  
  // Update user online status and last seen in database
  const updateResult = await User.findOneAndUpdate(
    { profileId: profileId },
    { isOnline: true, lastSeen: new Date() },
    { new: true }
  );
  
  console.log(`📱 User ${profileId} online status updated:`, updateResult ? 'Success' : 'Failed');

  // Get user's friends list
  const user = await User.findOne({ profileId: profileId });
  if (!user) {
    console.error(`❌ User ${profileId} not found in database`);
    return;
  }

  // Send immediate snapshot of friends' online statuses to the connecting user
  if (user.friends.length > 0) {
    console.log(`📥 Sending immediate snapshot of ${user.friends.length} friends' statuses to ${profileId}`);
    
    // Use fast in-memory lookup instead of database query
    const friendsSnapshot = getOnlineUsersSnapshot(user.friends);
    
    // Send snapshot as a single event for efficiency
    socket.emit('friendsStatusSnapshot', {
      friends: friendsSnapshot,
      timestamp: new Date()
    });
    
    console.log(`📤 Sent snapshot to ${profileId}:`, friendsSnapshot.map(f => `${f.profileId}:${f.isOnline ? 'online' : 'offline'}`).join(', '));
  }

  // Broadcast to friends that this user came online (only if they weren't already online)
  if (!wasAlreadyOnline && user.friends.length > 0) {
    console.log(`📢 Broadcasting ${profileId} online status to ${user.friends.length} friends`);
    
    const { broadcastToFriends } = require('./presence.handler');
    await broadcastToFriends(profileId, 'friendOnlineStatus', {
      profileId: profileId,
      isOnline: true,
      lastSeen: new Date()
    }, io, userSockets);
  } else if (wasAlreadyOnline) {
    console.log(`ℹ️ User ${profileId} was already online, skipping friend notification`);
  }
};

/**
 * Handle socket disconnect
 */
const handleDisconnect = async (socket, io, userSockets, userLastPing, onlineUsers) => {
  console.log(`🔌 Socket ${socket.id} disconnected`);
  
  // Find the user associated with this socket
  let disconnectedUserId = null;
  for (let [profileId, socketId] of userSockets) {
    if (socketId === socket.id) {
      disconnectedUserId = profileId;
      break;
    }
  }
  
  if (disconnectedUserId) {
    console.log(`👤 User ${disconnectedUserId} disconnected`);
    
    // Remove from all tracking maps
    userSockets.delete(disconnectedUserId);
    userLastPing.delete(disconnectedUserId);
    removeOnlineUser(disconnectedUserId);
    
    // Update user offline status and last seen in database
    const updateResult = await User.findOneAndUpdate(
      { profileId: disconnectedUserId },
      { isOnline: false, lastSeen: new Date() },
      { new: true }
    );
    
    console.log(`📱 User ${disconnectedUserId} offline status updated:`, updateResult ? 'Success' : 'Failed');

    // Immediately broadcast offline status to friends
    const { broadcastToFriends } = require('./presence.handler');
    await broadcastToFriends(disconnectedUserId, 'friendOnlineStatus', {
      profileId: disconnectedUserId,
      isOnline: false,
      lastSeen: new Date()
    }, io, userSockets);
  } else {
    console.log(`⚠️ No user found for disconnected socket ${socket.id}`);
  }
};

/**
 * Handle ping/pong heartbeat
 */
const handlePing = (socket, profileId) => {
  socket.emit('pong');
  if (profileId) {
    userLastPing.set(profileId, Date.now());
    console.log(`🏓 Ping received from user ${profileId}`);
  }
};

module.exports = {
  handleRegister,
  handleDisconnect,
  handlePing,
  userSockets,
  userLastPing,
  onlineUsers,
  addOnlineUser,
  removeOnlineUser,
  isUserOnline,
  getOnlineUsersSnapshot
};

