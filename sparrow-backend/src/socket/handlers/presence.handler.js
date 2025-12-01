const User = require('../../models/User');

/**
 * Presence Handler
 * Handles user online/offline status and presence updates
 */

/**
 * Broadcast to all friends of a user
 */
const broadcastToFriends = async (profileId, event, data, io, userSockets) => {
  try {
    const user = await User.findOne({ profileId: profileId });
    if (!user || !user.friends.length) return;

    console.log(`📢 Broadcasting ${event} to ${user.friends.length} friends of ${profileId}`);
    
    user.friends.forEach(friendId => {
      const friendSocketId = userSockets.get(friendId);
      if (friendSocketId) {
        io.to(friendSocketId).emit(event, data);
        console.log(`📤 Sent ${event} to friend ${friendId}`);
      } else {
        console.log(`⚠️ Friend ${friendId} not connected, skipping ${event}`);
      }
    });
  } catch (error) {
    console.error(`❌ Error broadcasting ${event}:`, error);
  }
};

/**
 * Send notification to a specific user
 */
const sendNotificationToUser = async (userId, event, data, io, userSockets) => {
  try {
    const userSocketId = userSockets.get(userId);
    if (userSocketId) {
      io.to(userSocketId).emit(event, data);
      console.log(`📤 Sent ${event} notification to user ${userId}`);
    } else {
      console.log(`⚠️ User ${userId} not connected, cannot send ${event} notification`);
    }
  } catch (error) {
    console.error(`❌ Error sending ${event} notification to user ${userId}:`, error);
  }
};

module.exports = {
  broadcastToFriends,
  sendNotificationToUser
};

