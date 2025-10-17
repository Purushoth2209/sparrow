const { Server } = require('socket.io');
const Message = require('./models/Message');
const User = require('./models/User');
const { sendMessage, decryptSingleMessage } = require('./controllers/messageController');

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
      console.log(`🔍 DEBUG: Socket registration - Before registration userSockets map:`, Array.from(userSockets.entries()));
      
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
      console.log(`🔍 DEBUG: Socket registration - userSockets map after registration:`, Array.from(userSockets.entries()));
      
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
            
            // Get sender's username for notifications
            const sender = await User.findOne({ profileId: msg.senderId });
            
            const messageWithTime = {
              ...decryptedMessage,
              timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              senderUsername: sender ? sender.username : 'Unknown User',
              isDeliveredOnConnect: true // Flag to indicate this was delivered on connect
            };
            
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

        // Format message with time for display
        const messageWithTime = {
          ...savedMessage,
          timestamp: new Date(savedMessage.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
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
          
          // Get the full message from database for decryption
          const fullMessage = await Message.findById(savedMessage._id);
          if (fullMessage) {
            // Decrypt message for real-time display to receiver
            const decryptedMessage = await decryptSingleMessage(fullMessage);
            decryptedMessage.timestamp = messageWithTime.timestamp;
            decryptedMessage.status = 'delivered';
            decryptedMessage.deliveredAt = new Date();
            
            // Get sender's username for notifications
            const sender = await User.findOne({ profileId: senderId });
            decryptedMessage.senderUsername = sender ? sender.username : 'Unknown User';
            
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
