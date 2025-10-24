const { Server } = require('socket.io');
const Message = require('./models/Message');
const User = require('./models/User');
const { sendMessage, decryptSingleMessage } = require('./controllers/messageController');
const OptimizedKMSEnvelopeEncryption = require('./utils/optimizedKmsEncryption');

// Initialize optimized encryption service for socket operations
const socketEncryptionService = new OptimizedKMSEnvelopeEncryption({
  dekRotationInterval: 30 * 60 * 1000, // 30 minutes
  dekMaxAge: 60 * 60 * 1000, // 1 hour max age
  batchTimeout: 50, // 50ms batch window
  batchSize: 10 // Max 10 messages per batch
});

const userSockets = new Map(); // profileId -> socketId
const userLastPing = new Map(); // Track last ping time for each user
const onlineUsers = new Map(); // profileId -> { isOnline: true, lastSeen: Date, socketId: string }
let io;

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

const broadcastToFriends = async (profileId, event, data) => {
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

// Helper function to send notification to a specific user
const sendNotificationToUser = async (userId, event, data) => {
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
          removeOnlineUser(profileId);
          
          // Notify friends about the cleanup
          await broadcastToFriends(profileId, 'friendOnlineStatus', {
            profileId: profileId,
            isOnline: false,
            lastSeen: new Date()
          });
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
          await socketEncryptionService.rotateSessionDEK(sessionId);
          rotatedCount++;
        } catch (error) {
          console.error(`❌ Failed to rotate DEK for session ${sessionId}:`, error);
        }
      }
      
      if (rotatedCount > 0) {
        console.log(`✅ Rotated DEKs for ${rotatedCount} active sessions`);
        
        // Log encryption statistics
        const stats = socketEncryptionService.getStats();
        console.log(`📊 Encryption stats - Cache hit rate: ${stats.cacheHitRate.toFixed(2)}%, KMS calls: ${stats.kmsCalls}, Cache size: ${stats.cacheSize}`);
      }
    } catch (error) {
      console.error('❌ Error in periodic DEK rotation:', error);
    }
  }, 30 * 60 * 1000); // Rotate every 30 minutes

  io.on('connection', (socket) => {
    // Handle heartbeat/ping
    socket.on('ping', (profileId) => {
      socket.emit('pong');
      if (profileId) {
        userLastPing.set(profileId, Date.now());
        console.log(`🏓 Ping received from user ${profileId}`);
      }
    });

    socket.on('register', async (profileId) => {
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
        
        await broadcastToFriends(profileId, 'friendOnlineStatus', {
          profileId: profileId,
          isOnline: true,
          lastSeen: new Date()
        });
      } else if (wasAlreadyOnline) {
        console.log(`ℹ️ User ${profileId} was already online, skipping friend notification`);
      }

      // Only fetch messages that haven't been delivered yet
      const undeliveredMessages = await Message.find({ 
        receiverId: profileId,
        status: { $ne: 'delivered' }
      }).sort({ timestamp: 1 });
      
      console.log(`🔍 DEBUG: Found ${undeliveredMessages.length} undelivered messages for user ${profileId}`);
      
      if (undeliveredMessages.length > 0) {
        console.log(`📨 Delivering ${undeliveredMessages.length} undelivered messages to ${profileId}`);
        
        // Track delivered message IDs to prevent re-delivery
        const deliveredMessageIds = [];
        
        // Process each undelivered message
        for (const msg of undeliveredMessages) {
          try {
            // Decrypt the message for display
            const decryptedMessage = await decryptSingleMessage(msg);
            
            // Get sender's username for display
            const sender = await User.findOne({ profileId: msg.senderId });
            
            const messageWithTime = {
              ...decryptedMessage,
              timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              senderUsername: sender ? sender.username : 'Unknown User',
              isDeliveredOnConnect: true // Flag to indicate this was delivered on connect
            };
            
            // EMIT MESSAGE NOTIFICATION EVENT for undelivered messages too
            console.log('🔔 Emitting messageReceivedNotification event for undelivered message:', {
              senderId: msg.senderId,
              senderName: sender ? sender.username : 'Unknown User',
              senderProfileImage: sender ? sender.profileImage : null,
              messagePreview: decryptedMessage.content ? decryptedMessage.content.substring(0, 30) : 'Message',
              timestamp: new Date(),
              messageId: msg._id
            });
            
            // Send notification event for undelivered message
            socket.emit('messageReceivedNotification', {
              senderId: msg.senderId,
              senderName: sender ? sender.username : 'Unknown User',
              senderProfileImage: sender ? sender.profileImage : null,
              messagePreview: decryptedMessage.content ? decryptedMessage.content.substring(0, 30) : 'Message',
              timestamp: new Date(),
              messageId: msg._id,
              fullMessage: messageWithTime // Include full message for immediate display
            });
            
            socket.emit('receiveMessage', messageWithTime);
            
            // Update message status to delivered (but keep in database for read tracking)
            await Message.findByIdAndUpdate(msg._id, { 
              status: 'delivered', 
              deliveredAt: new Date() 
            });
            
            deliveredMessageIds.push(msg._id);
            
            // Notify sender that their message was delivered
            const senderSocketId = userSockets.get(msg.senderId);
            if (senderSocketId) {
              io.to(senderSocketId).emit('messageStatusUpdate', {
                messageId: msg._id,
                status: 'delivered',
                deliveredAt: new Date()
              });
            }
          } catch (decryptError) {
            console.error(`❌ Failed to decrypt undelivered message ${msg._id}:`, decryptError);
            // Send error message to user
            socket.emit('receiveMessage', {
              ...msg.toObject(),
              content: '[Message could not be decrypted]',
              decryptionError: true,
              timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              isDeliveredOnConnect: true
            });
          }
        }
        
        // Delete all delivered messages after successful delivery
        if (deliveredMessageIds.length > 0) {
          const deleteResult = await Message.deleteMany({
            _id: { $in: deliveredMessageIds }
          });
          console.log(`🗑️ DELETED ${deleteResult.deletedCount} delivered messages for user ${profileId}`);
        }
      } else {
        console.log(`📭 No undelivered messages for ${profileId}`);
      }
    });

    socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
      try {
        // Use the encrypted message controller to send message
        const savedMessage = await sendMessage(senderId, receiverId, content);

        // Keep timestamp as ISO string for frontend timezone handling
        const messageWithTime = {
          ...savedMessage,
          timestamp: new Date(savedMessage.timestamp).toISOString(),
        };

        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          // Get the full message from database for decryption
          const fullMessage = await Message.findById(savedMessage._id);
          if (fullMessage) {
            // Decrypt message for real-time display to receiver
            const decryptedMessage = await decryptSingleMessage(fullMessage);
            decryptedMessage.timestamp = messageWithTime.timestamp;
            
            // Get sender's username for display
            const sender = await User.findOne({ profileId: senderId });
            decryptedMessage.senderUsername = sender ? sender.username : 'Unknown User';
            
            // EMIT MESSAGE NOTIFICATION EVENT - This fires 100% reliably for every message
            // This happens after encryption and save but before delivery acknowledgment
            console.log('🔔 Emitting messageReceivedNotification event:', {
              senderId: senderId,
              senderName: sender ? sender.username : 'Unknown User',
              senderProfileImage: sender ? sender.profileImage : null,
              messagePreview: decryptedMessage.content ? decryptedMessage.content.substring(0, 30) : 'Message',
              timestamp: new Date(),
              messageId: savedMessage._id
            });
            
            // Send notification event to receiver
            io.to(receiverSocketId).emit('messageReceivedNotification', {
              senderId: senderId,
              senderName: sender ? sender.username : 'Unknown User',
              senderProfileImage: sender ? sender.profileImage : null,
              messagePreview: decryptedMessage.content ? decryptedMessage.content.substring(0, 30) : 'Message',
              timestamp: new Date(),
              messageId: savedMessage._id,
              fullMessage: decryptedMessage // Include full message for immediate display
            });
            
            // Message delivered immediately (receiver is online)
            await Message.findByIdAndUpdate(savedMessage._id, { 
              status: 'delivered', 
              deliveredAt: new Date() 
            });
            decryptedMessage.status = 'delivered';
            decryptedMessage.deliveredAt = new Date();
            
            // Send the actual message for display
            io.to(receiverSocketId).emit('receiveMessage', decryptedMessage);
            
            // Delete the message after delivery (wait a bit to ensure frontend received it)
            setTimeout(async () => {
              try {
                const deleteResult = await Message.findByIdAndDelete(savedMessage._id);
                if (deleteResult) {
                  console.log(`🗑️ DELETED real-time message ${savedMessage._id} after delivery to ${receiverId}`);
                }
              } catch (error) {
                console.error('❌ Error deleting real-time message:', error);
              }
            }, 1000); // 1 second delay to ensure frontend received the message
          }
          
          // Notify sender that message was delivered
          socket.emit('messageStatusUpdate', {
            messageId: savedMessage._id,
            status: 'delivered',
            deliveredAt: new Date()
          });
        } else {
          // Receiver is offline, notify sender that message was sent
          socket.emit('messageStatusUpdate', {
            messageId: savedMessage._id,
            status: 'sent',
            sentAt: new Date()
          });
        }
        
        // Get the full message from database for decryption
        const fullMessage = await Message.findById(savedMessage._id);
        if (fullMessage) {
          // Send decrypted message back to sender for display
          const decryptedMessageForSender = await decryptSingleMessage(fullMessage);
          decryptedMessageForSender.timestamp = messageWithTime.timestamp;
          socket.emit('messageSent', decryptedMessageForSender);
        }
      } catch (error) {
        console.error('❌ Error sending encrypted message:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    socket.on('logout', async ({ profileId }) => {
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
        removeOnlineUser(profileId);
        
        console.log(`👤 User ${profileId} removed from all tracking maps`);

        // Immediately broadcast offline status to friends
        await broadcastToFriends(profileId, 'friendOnlineStatus', {
          profileId: profileId,
          isOnline: false,
          lastSeen: new Date()
        });
        
        console.log(`✅ Logout completed for user ${profileId}`);
      } catch (error) {
        console.error('Error handling logout:', error);
      }
    });

    socket.on('messageDelivered', async ({ messageId, receiverId }) => {
      try {
        console.log(`✅ Message ${messageId} delivered acknowledgment received from ${receiverId}`);
        
        // Delete the message after successful delivery acknowledgment
        const deleteResult = await Message.findByIdAndDelete(messageId);
        
        if (deleteResult) {
          console.log(`🗑️ DELETED message ${messageId} after delivery acknowledgment from ${receiverId}`);
          
          // Notify sender that message was delivered and deleted
          const senderSocketId = userSockets.get(deleteResult.senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('messageStatusUpdate', {
              messageId: messageId,
              status: 'delivered',
              deliveredAt: new Date(),
              deleted: true
            });
          }
        } else {
          console.log(`⚠️ Message ${messageId} not found for deletion`);
        }
      } catch (error) {
        console.error('❌ Error handling message delivery acknowledgment:', error);
      }
    });

    socket.on('markMessagesAsRead', async ({ senderId, receiverId }) => {
      try {
        console.log(`📖 Marking messages as read from ${senderId} to ${receiverId}`);
        
        // Mark all messages from sender to receiver as read
        const updateResult = await Message.updateMany(
          { 
            senderId: senderId, 
            receiverId: receiverId, 
            status: { $ne: 'read' } 
          },
          { 
            status: 'read', 
            readAt: new Date() 
          }
        );
        
        console.log(`✅ Marked ${updateResult.modifiedCount} messages as read`);

        // Notify sender that messages were read
        const senderSocketId = userSockets.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messagesRead', {
            receiverId: receiverId,
            readAt: new Date(),
            messageCount: updateResult.modifiedCount
          });
          
          // Also send individual message status updates for each read message
          const readMessages = await Message.find({
            senderId: senderId,
            receiverId: receiverId,
            status: 'read'
          }).sort({ timestamp: -1 }).limit(10); // Get recent messages
          
          readMessages.forEach(msg => {
            io.to(senderSocketId).emit('messageStatusUpdate', {
              messageId: msg._id,
              status: 'read',
              readAt: msg.readAt || new Date()
            });
          });
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    socket.on('disconnect', async () => {
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
        await broadcastToFriends(disconnectedUserId, 'friendOnlineStatus', {
          profileId: disconnectedUserId,
          isOnline: false,
          lastSeen: new Date()
        });
      } else {
        console.log(`⚠️ No user found for disconnected socket ${socket.id}`);
      }
    });
  });

  return io;
};

module.exports = { initializeSocket, userSockets, io, sendNotificationToUser };
