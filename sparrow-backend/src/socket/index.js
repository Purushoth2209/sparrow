const { Server } = require('socket.io');
const User = require('../models/User');
const connectionHandler = require('./handlers/connection.handler');
const messageHandler = require('./handlers/message.handler');
const presenceHandler = require('./handlers/presence.handler');
const friendHandler = require('./handlers/friend.handler');
const events = require('./events');

let io;
const { userSockets, userLastPing, onlineUsers } = connectionHandler;

/**
 * Initialize Socket.IO server
 */
const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
          process.env.FRONTEND_URL || 'http://localhost:3000',
          'https://sparrow-frontend-sigma.vercel.app',
          'https://www.sparrowchat.in',
          'https://sparrowchat.in',
          'http://localhost:3000'
        ];
        
        // Check exact matches first
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else if (origin.endsWith('.vercel.app')) {
          // Allow any Vercel deployment
          console.log('✅ Socket.IO CORS allowed Vercel origin:', origin);
          callback(null, true);
        } else {
          console.log('❌ Socket.IO CORS blocked origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ["GET", "POST"],
      credentials: true
    },
  });

  // Cleanup: Set all users as offline on server startup
  // This handles cases where server restarts and users were marked as online
  try {
    await User.updateMany({}, { isOnline: false });
    console.log('🧹 Cleaned up online status on server startup');
  } catch (error) {
    console.error('❌ Error cleaning up online status:', error);
  }

  // Periodic cleanup: Check for users marked as online but not in userSockets
  setInterval(async () => {
    try {
      const currentTime = Date.now();
      const PING_TIMEOUT = 60000; // 60 seconds timeout
      
      console.log(`🔍 Periodic cleanup: ${onlineUsers.size} users in online map, ${userSockets.size} active sockets`);
      
      // Check each user in the online map
      for (const [profileId, onlineData] of onlineUsers) {
        const lastPing = userLastPing.get(profileId);
        const isSocketActive = userSockets.has(profileId);
        const isPingStale = lastPing && (currentTime - lastPing) > PING_TIMEOUT;
        
        if (!isSocketActive || isPingStale) {
          console.log(`🔧 Cleaning up stale online status for user ${profileId} (socket: ${isSocketActive}, ping stale: ${isPingStale})`);
          
          // Update database
          await User.findOneAndUpdate(
            { profileId: profileId },
            { isOnline: false, lastSeen: new Date() }
          );
          
          // Remove from all tracking maps
          userSockets.delete(profileId);
          userLastPing.delete(profileId);
          connectionHandler.removeOnlineUser(profileId);
          
          // Notify friends about the cleanup
          await presenceHandler.broadcastToFriends(profileId, events.FRIEND_ONLINE_STATUS, {
            profileId: profileId,
            isOnline: false,
            lastSeen: new Date()
          }, io, userSockets);
        }
      }
    } catch (error) {
      console.error('❌ Error in periodic cleanup:', error);
    }
  }, 15000); // Check every 15 seconds (more frequent)

  // Periodic DEK rotation for active sessions
  setInterval(async () => {
    try {
      console.log(`🔄 Starting periodic DEK rotation for active sessions`);
      
      // Get all active user pairs for DEK rotation
      const activeSessions = new Set();
      for (const [profileId] of onlineUsers) {
        const user = await User.findOne({ profileId: profileId });
        if (user && user.friends.length > 0) {
          // Create session IDs for all friend pairs
          user.friends.forEach(friendId => {
            const sessionId = `${profileId}-${friendId}`;
            activeSessions.add(sessionId);
          });
        }
      }
      
      // Rotate DEKs for active sessions
      let rotatedCount = 0;
      for (const sessionId of activeSessions) {
        try {
          await messageHandler.socketEncryptionService.rotateSessionDEK(sessionId);
          rotatedCount++;
        } catch (error) {
          console.error(`❌ Failed to rotate DEK for session ${sessionId}:`, error);
        }
      }
      
      if (rotatedCount > 0) {
        console.log(`✅ Rotated DEKs for ${rotatedCount} active sessions`);
        
        // Log encryption statistics
        const stats = messageHandler.socketEncryptionService.getStats();
        console.log(`📊 Encryption stats - Cache hit rate: ${stats.cacheHitRate.toFixed(2)}%, KMS calls: ${stats.kmsCalls}, Cache size: ${stats.cacheSize}`);
      }
    } catch (error) {
      console.error('❌ Error in periodic DEK rotation:', error);
    }
  }, 30 * 60 * 1000); // Rotate every 30 minutes

  io.on('connection', (socket) => {
    // Handle heartbeat/ping
    socket.on(events.PING, (profileId) => {
      connectionHandler.handlePing(socket, profileId);
    });

    socket.on(events.REGISTER, async (profileId) => {
      await connectionHandler.handleRegister(socket, io, profileId);
      
      // Deliver undelivered messages
      await messageHandler.deliverUndeliveredMessages(socket, userSockets, profileId);
    });

    socket.on(events.SEND_MESSAGE, async (data) => {
      await messageHandler.handleSendMessage(socket, io, userSockets, data);
    });

    socket.on(events.LOGOUT, async ({ profileId }) => {
      try {
        console.log(`🚪 User ${profileId} logging out`);
        
        // Update user offline status and last seen in database
        await User.findOneAndUpdate(
          { profileId: profileId },
          { isOnline: false, lastSeen: new Date() }
        );
        
        // Remove from all tracking maps
        userSockets.delete(profileId);
        userLastPing.delete(profileId);
        connectionHandler.removeOnlineUser(profileId);
        
        console.log(`👤 User ${profileId} removed from all tracking maps`);

        // Immediately broadcast offline status to friends
        await presenceHandler.broadcastToFriends(profileId, events.FRIEND_ONLINE_STATUS, {
          profileId: profileId,
          isOnline: false,
          lastSeen: new Date()
        }, io, userSockets);
        
        console.log(`✅ Logout completed for user ${profileId}`);
      } catch (error) {
        console.error('Error handling logout:', error);
      }
    });

    socket.on(events.MESSAGE_DELIVERED, async (data) => {
      await messageHandler.handleMessageDelivered(socket, io, userSockets, data);
    });

    socket.on(events.MARK_MESSAGES_AS_READ, async (data) => {
      await messageHandler.handleMarkMessagesAsRead(socket, io, userSockets, data);
    });

    socket.on(events.DISCONNECT, async () => {
      await connectionHandler.handleDisconnect(socket, io, userSockets, userLastPing, onlineUsers);
    });
  });

  return io;
};

const getIO = () => io;

const sendNotificationToUser = async (userId, event, data) => {
  return await presenceHandler.sendNotificationToUser(userId, event, data, io, userSockets);
};

module.exports = { 
  initializeSocket, 
  userSockets, 
  io: getIO,
  sendNotificationToUser
};

