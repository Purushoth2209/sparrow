const { Server } = require('socket.io');
const Message = require('./models/Message');
const User = require('./models/User');

const userSockets = new Map();
const userLastPing = new Map(); // Track last ping time for each user
let io;

const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'https://sparrow-frontend-sigma.vercel.app'
      ],
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
      const onlineUsers = await User.find({ isOnline: true });
      const currentTime = Date.now();
      const PING_TIMEOUT = 60000; // 60 seconds timeout
      
      console.log(`🔍 Periodic cleanup: Found ${onlineUsers.length} users marked as online, ${userSockets.size} active sockets`);
      
      for (const user of onlineUsers) {
        const lastPing = userLastPing.get(user.profileId);
        const isSocketActive = userSockets.has(user.profileId);
        const isPingStale = lastPing && (currentTime - lastPing) > PING_TIMEOUT;
        
        if (!isSocketActive || isPingStale) {
          console.log(`🔧 Cleaning up stale online status for user ${user.profileId} (socket: ${isSocketActive}, ping stale: ${isPingStale})`);
          
          await User.findOneAndUpdate(
            { profileId: user.profileId },
            { isOnline: false, lastSeen: new Date() }
          );
          
          // Remove from tracking
          userSockets.delete(user.profileId);
          userLastPing.delete(user.profileId);
          
          // Notify friends about the cleanup
          if (user.friends && user.friends.length > 0) {
            user.friends.forEach(friendId => {
              const friendSocketId = userSockets.get(friendId);
              if (friendSocketId) {
                io.to(friendSocketId).emit('friendOnlineStatus', {
                  profileId: user.profileId,
                  isOnline: false,
                  lastSeen: new Date()
                });
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in periodic cleanup:', error);
    }
  }, 15000); // Check every 15 seconds (more frequent)

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
      
      // Remove any existing socket for this user (handle reconnection)
      for (let [existingProfileId, existingSocketId] of userSockets) {
        if (existingProfileId === profileId) {
          console.log(`🔄 Removing existing socket for user ${profileId}`);
          userSockets.delete(existingProfileId);
          break;
        }
      }
      
      userSockets.set(profileId, socket.id);
      userLastPing.set(profileId, Date.now());
      console.log(`✅ User ${profileId} registered with socket ${socket.id}`);
      
      // Update user online status and last seen
      const updateResult = await User.findOneAndUpdate(
        { profileId: profileId },
        { isOnline: true, lastSeen: new Date() },
        { new: true }
      );
      
      console.log(`📱 User ${profileId} online status updated:`, updateResult ? 'Success' : 'Failed');

      // Notify friends about online status
      const user = await User.findOne({ profileId: profileId });
      if (user && user.friends.length > 0) {
        console.log(`📢 Notifying ${user.friends.length} friends about ${profileId} coming online`);
        user.friends.forEach(friendId => {
          const friendSocketId = userSockets.get(friendId);
          if (friendSocketId) {
            io.to(friendSocketId).emit('friendOnlineStatus', {
              profileId: profileId,
              isOnline: true,
              lastSeen: new Date()
            });
            console.log(`📤 Notified friend ${friendId} about ${profileId} online`);
          } else {
            console.log(`⚠️ Friend ${friendId} not connected, skipping notification`);
          }
        });
      }

      const undeliveredMessages = await Message.find({ receiverId: profileId }).sort({ timestamp: 1 });
      
      if (undeliveredMessages.length > 0) {
        console.log(`📨 Delivering ${undeliveredMessages.length} undelivered messages to ${profileId}`);
        
        // Notify senders that their messages are now delivered
        const senderIds = [...new Set(undeliveredMessages.map(msg => msg.senderId))];
        
        undeliveredMessages.forEach((msg) => {
          const messageWithTime = {
            ...msg.toObject(),
            timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          };
          socket.emit('receiveMessage', messageWithTime);
          
          // Update message status to delivered
          Message.findByIdAndUpdate(msg._id, { 
            status: 'delivered', 
            deliveredAt: new Date() 
          }).exec();
          
          // Notify sender that their message was delivered
          const senderSocketId = userSockets.get(msg.senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('messageStatusUpdate', {
              messageId: msg._id,
              status: 'delivered',
              deliveredAt: new Date()
            });
          }
        });
      }

      await Message.deleteMany({ receiverId: profileId });
    });

    socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
      try {
        // Validate friendship before allowing message
        const sender = await User.findOne({ profileId: senderId });
        if (!sender || !sender.friends.includes(receiverId)) {
          socket.emit('error', { message: 'Cannot send message to non-friend user' });
          return;
        }

        const savedMessage = await Message.create({
          senderId,
          receiverId,
          content,
          timestamp: new Date(),
          status: 'sent'
        });

        const fetchedMessage = await Message.findById(savedMessage._id);

        const messageWithTime = {
          ...fetchedMessage.toObject(),
          timestamp: new Date(fetchedMessage.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };

        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          // Message delivered immediately (receiver is online)
          await Message.findByIdAndUpdate(savedMessage._id, { 
            status: 'delivered', 
            deliveredAt: new Date() 
          });
          messageWithTime.status = 'delivered';
          messageWithTime.deliveredAt = new Date();
          
          io.to(receiverSocketId).emit('receiveMessage', messageWithTime);
          
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
        
        // Send message back to sender with initial status
        socket.emit('messageSent', messageWithTime);
      } catch (error) {
        console.error('Error saving or delivering message:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    socket.on('logout', async ({ profileId }) => {
      try {
        console.log(`🚪 User ${profileId} logging out`);
        
        // Update user offline status and last seen
        await User.findOneAndUpdate(
          { profileId: profileId },
          { isOnline: false, lastSeen: new Date() }
        );
        
        // Remove from userSockets and lastPing
        userSockets.delete(profileId);
        userLastPing.delete(profileId);
        console.log(`👤 User ${profileId} removed from active sockets`);

        // Notify friends about offline status
        const user = await User.findOne({ profileId: profileId });
        if (user && user.friends.length > 0) {
          console.log(`📢 Notifying ${user.friends.length} friends about ${profileId} going offline (logout)`);
          user.friends.forEach(friendId => {
            const friendSocketId = userSockets.get(friendId);
            if (friendSocketId) {
              io.to(friendSocketId).emit('friendOnlineStatus', {
                profileId: profileId,
                isOnline: false,
                lastSeen: new Date()
              });
              console.log(`📤 Notified friend ${friendId} about ${profileId} offline (logout)`);
            }
          });
        }
        
        console.log(`✅ Logout completed for user ${profileId}`);
      } catch (error) {
        console.error('Error handling logout:', error);
      }
    });

    socket.on('markMessagesAsRead', async ({ senderId, receiverId }) => {
      try {
        // Mark all messages from sender to receiver as read
        await Message.updateMany(
          { senderId: senderId, receiverId: receiverId, status: { $ne: 'read' } },
          { status: 'read', readAt: new Date() }
        );

        // Notify sender that messages were read
        const senderSocketId = userSockets.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messagesRead', {
            receiverId: receiverId,
            readAt: new Date()
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
              readAt: new Date()
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
        userSockets.delete(disconnectedUserId);
        userLastPing.delete(disconnectedUserId);
        
        // Update user offline status and last seen
        const updateResult = await User.findOneAndUpdate(
          { profileId: disconnectedUserId },
          { isOnline: false, lastSeen: new Date() },
          { new: true }
        );
        
        console.log(`📱 User ${disconnectedUserId} offline status updated:`, updateResult ? 'Success' : 'Failed');

        // Notify friends about offline status
        const user = await User.findOne({ profileId: disconnectedUserId });
        if (user && user.friends.length > 0) {
          console.log(`📢 Notifying ${user.friends.length} friends about ${disconnectedUserId} going offline`);
          user.friends.forEach(friendId => {
            const friendSocketId = userSockets.get(friendId);
            if (friendSocketId) {
              io.to(friendSocketId).emit('friendOnlineStatus', {
                profileId: disconnectedUserId,
                isOnline: false,
                lastSeen: new Date()
              });
              console.log(`📤 Notified friend ${friendId} about ${disconnectedUserId} offline`);
            } else {
              console.log(`⚠️ Friend ${friendId} not connected, skipping notification`);
            }
          });
        }
      } else {
        console.log(`⚠️ No user found for disconnected socket ${socket.id}`);
      }
    });
  });

  return io;
};

module.exports = { initializeSocket, userSockets, io };
