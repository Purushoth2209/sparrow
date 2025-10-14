const { Server } = require('socket.io');
const Message = require('./models/Message');
const User = require('./models/User');
const { sendMessage, decryptSingleMessage } = require('./controllers/messageController');
const { getChatList } = require('./controllers/chatController');

const userSockets = new Map();
const userLastPing = new Map(); // Track last ping time for each user
let io;

/**
 * Notification Helper Functions
 * 
 * These functions handle real-time notifications for various events
 */

/**
 * Send real-time notification to a user
 * @param {string} userId - Target user's profile ID
 * @param {string} event - Event type
 * @param {Object} data - Notification data
 */
async function sendNotification(userId, event, data) {
  try {
    const socketId = userSockets.get(userId);
    if (socketId && io) {
      io.to(socketId).emit(event, {
        ...data,
        timestamp: new Date(),
        userId: userId
      });
    }
  } catch (error) {
    console.error(`❌ Failed to send notification to ${userId}:`, error);
  }
}

/**
 * Notify user about new message received
 * @param {string} receiverId - Message receiver's profile ID
 * @param {Object} message - Message object
 */
async function notifyNewMessage(receiverId, message) {
  try {
    // Get sender information
    const sender = await User.findOne({ profileId: message.senderId });
    if (!sender) return;

    // Decrypt message content for notification
    let messageContent = '[Encrypted Message]';
    try {
      if (message.isEncrypted) {
        const decryptedMessage = await decryptSingleMessage(message);
        messageContent = decryptedMessage.content;
      } else {
        messageContent = message.content;
      }
    } catch (error) {
      console.error('❌ Failed to decrypt message for notification:', error);
    }

    await sendNotification(receiverId, 'message_received', {
      messageId: message._id,
      senderId: message.senderId,
      senderUsername: sender.username,
      content: messageContent,
      timestamp: message.timestamp,
      status: message.status
    });
  } catch (error) {
    console.error('❌ Failed to notify new message:', error);
  }
}

/**
 * Notify user about friend request received
 * @param {string} receiverId - Friend request receiver's profile ID
 * @param {Object} friendRequest - Friend request object
 */
async function notifyFriendRequest(receiverId, friendRequest) {
  try {
    // Get requester information
    const requester = await User.findOne({ profileId: friendRequest.requesterId });
    if (!requester) return;

    await sendNotification(receiverId, 'friend_request', {
      requestId: friendRequest._id,
      requesterId: friendRequest.requesterId,
      requesterUsername: requester.username,
      timestamp: friendRequest.timestamp,
      status: friendRequest.status
    });
  } catch (error) {
    console.error('❌ Failed to notify friend request:', error);
  }
}

/**
 * Notify both users about friend request acceptance
 * @param {string} userId1 - First user's profile ID
 * @param {string} userId2 - Second user's profile ID
 * @param {Object} friendRequest - Accepted friend request object
 */
async function notifyFriendAccept(userId1, userId2, friendRequest) {
  try {
    // Get both users' information
    const [user1, user2] = await Promise.all([
      User.findOne({ profileId: userId1 }),
      User.findOne({ profileId: userId2 })
    ]);

    if (!user1 || !user2) return;

    // Notify both users
    await Promise.all([
      sendNotification(userId1, 'friend_accept', {
        friendId: userId2,
        friendUsername: user2.username,
        timestamp: friendRequest.acceptedAt || new Date(),
        status: 'accepted'
      }),
      sendNotification(userId2, 'friend_accept', {
        friendId: userId1,
        friendUsername: user1.username,
        timestamp: friendRequest.acceptedAt || new Date(),
        status: 'accepted'
      })
    ]);
  } catch (error) {
    console.error('❌ Failed to notify friend accept:', error);
  }
}

/**
 * Notify user about friend request rejection
 * @param {string} requesterId - User who sent the friend request
 * @param {string} receiverId - User who rejected the friend request
 */
async function notifyFriendReject(requesterId, receiverId) {
  try {
    // Get both users' information
    const [requester, receiver] = await Promise.all([
      User.findOne({ profileId: requesterId }),
      User.findOne({ profileId: receiverId })
    ]);

    if (!requester || !receiver) return;

    // Notify the requester that their friend request was rejected
    await sendNotification(requesterId, 'friend_reject', {
      rejecterId: receiverId,
      rejecterUsername: receiver.username,
      timestamp: new Date(),
      status: 'rejected'
    });
  } catch (error) {
    console.error('❌ Failed to notify friend reject:', error);
  }
}

/**
 * Notify user about being removed as friend
 * @param {string} removerId - User who removed the friend
 * @param {string} removedUserId - User who was removed as friend
 */
async function notifyFriendRemoval(removerId, removedUserId) {
  try {
    // Get both users' information
    const [remover, removedUser] = await Promise.all([
      User.findOne({ profileId: removerId }),
      User.findOne({ profileId: removedUserId })
    ]);

    if (!remover || !removedUser) return;

    // Notify the user who was removed
    await sendNotification(removedUserId, 'friend_removed', {
      removerId: removerId,
      removerUsername: remover.username,
      timestamp: new Date(),
      status: 'removed'
    });
  } catch (error) {
    console.error('❌ Failed to notify friend removal:', error);
  }
}

/**
 * Update chat list for users when new message is sent
 * @param {string} senderId - Message sender's profile ID
 * @param {string} receiverId - Message receiver's profile ID
 */
async function updateChatList(senderId, receiverId) {
  try {
    // Update chat list for both users
    const [senderChatList, receiverChatList] = await Promise.all([
      getChatList(senderId),
      getChatList(receiverId)
    ]);

    // Send updated chat list to both users
    await Promise.all([
      sendNotification(senderId, 'chat_list_updated', {
        chatList: senderChatList
      }),
      sendNotification(receiverId, 'chat_list_updated', {
        chatList: receiverChatList
      })
    ]);
  } catch (error) {
    console.error('❌ Failed to update chat list:', error);
  }
}

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

  // Periodic message cleanup: Delete old delivered messages
  setInterval(async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const result = await Message.deleteMany({
        status: 'delivered',
        deliveredAt: { $lt: oneHourAgo }
      });
      
      if (result.deletedCount > 0) {
        console.log(`🗑️ Cleaned up ${result.deletedCount} old delivered messages`);
      }
    } catch (error) {
      console.error('❌ Error in message cleanup:', error);
    }
  }, 300000); // Check every 5 minutes

  io.on('connection', (socket) => {
    console.log(`🔌 New socket connection: ${socket.id}`);
    
    // Authentication middleware for socket events
    socket.use(async (packet, next) => {
      try {
        const eventName = packet[0];
        console.log(`🔍 Middleware checking event: ${eventName}`);
        
        // Skip authentication for system events
        const systemEvents = ['ping', 'pong', 'register', 'test-connection', 'disconnect'];
        if (systemEvents.includes(eventName)) {
          console.log(`✅ Allowing system event: ${eventName}`);
          return next();
        }

        // For other events, check if user is registered
        const eventData = packet[1] || {};
        const profileId = eventData.profileId || eventData.senderId || eventData.userId || eventData.receiverId;
        console.log(`🔍 Event ${eventName} - profileId: ${profileId}`);
        
        if (!profileId) {
          console.log(`❌ No profileId for event ${eventName}`);
          return next(new Error(`Authentication required for ${eventName}`));
        }

        // Check if user is registered in our system
        if (!userSockets.has(profileId)) {
          console.log(`❌ User ${profileId} not registered in userSockets`);
          return next(new Error(`User ${profileId} not registered`));
        }

        // Verify user exists in database
        const user = await User.findOne({ profileId });
        if (!user) {
          console.log(`❌ User ${profileId} not found in database`);
          return next(new Error(`User ${profileId} not found`));
        }

        console.log(`✅ Allowing authenticated event: ${eventName} for user: ${profileId}`);
        next();
      } catch (error) {
        console.log(`❌ Middleware error for event ${packet[0]}:`, error.message);
        next(new Error('Authentication failed'));
      }
    });

    // Handle errors from middleware
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error.message);
      socket.emit('error', { message: error.message });
    });

    // Handle authentication errors
    socket.on('auth_error', (error) => {
      console.error(`❌ Authentication error for ${socket.id}:`, error.message);
      socket.emit('auth_error', { message: error.message });
    });

    // Handle heartbeat/ping
    socket.on('ping', (profileId) => {
      console.log(`🏓 Ping received from socket ${socket.id}, profileId: ${profileId}`);
      socket.emit('pong');
      if (profileId) {
        userLastPing.set(profileId, Date.now());
        console.log(`🏓 Ping received from user ${profileId}`);
      }
    });

    // Debug: Log all events received
    socket.onAny((eventName, ...args) => {
      console.log(`📡 Event received on socket ${socket.id}: ${eventName}`, args);
    });

    socket.on('test-connection', (data) => {
      console.log(`🧪 Test connection received from socket ${socket.id}:`, data);
      socket.emit('test-connection-response', { 
        status: 'success', 
        socketId: socket.id, 
        timestamp: new Date().toISOString() 
      });
    });

    socket.on('register', async (profileId) => {
      console.log(`🔗 User ${profileId} connecting with socket ${socket.id}`);
      console.log(`🔍 Current userSockets map size: ${userSockets.size}`);
      console.log(`🔍 Current userSockets entries:`, Array.from(userSockets.entries()));
      
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

      const undeliveredMessages = await Message.find({ 
        receiverId: profileId, 
        status: 'sent' 
      }).sort({ timestamp: 1 });
      
      if (undeliveredMessages.length > 0) {
        console.log(`📨 Delivering ${undeliveredMessages.length} undelivered messages to ${profileId}`);
        
        // Notify senders that their messages are now delivered
        const senderIds = [...new Set(undeliveredMessages.map(msg => msg.senderId))];
        
        // Process each undelivered message
        for (const msg of undeliveredMessages) {
          try {
            // Decrypt the message for display
            const decryptedMessage = await decryptSingleMessage(msg);
            
            // Get sender information for notification
            const sender = await User.findOne({ profileId: msg.senderId });
            
            const messageWithTime = {
              ...decryptedMessage,
              timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              senderUsername: sender ? sender.username : msg.senderId, // Include username for notifications
            };
            
            socket.emit('receiveMessage', messageWithTime);
            
            // Update message status to delivered
            await Message.findByIdAndUpdate(msg._id, { 
              status: 'delivered', 
              deliveredAt: new Date() 
            });
            
            // Notify sender that their message was delivered
            const senderSocketId = userSockets.get(msg.senderId);
            if (senderSocketId) {
              io.to(senderSocketId).emit('messageStatusUpdate', {
                messageId: msg._id,
                status: 'delivered',
                deliveredAt: new Date()
              });
            }
            
            // Messages will persist until chat is closed
            // No automatic deletion - messages stay until user closes the chat
          } catch (decryptError) {
            console.error(`❌ Failed to decrypt undelivered message ${msg._id}:`, decryptError);
            
            // Get sender information for error message
            const sender = await User.findOne({ profileId: msg.senderId });
            
            // Send error message to user
            socket.emit('receiveMessage', {
              ...msg.toObject(),
              content: '[Message could not be decrypted]',
              decryptionError: true,
              timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              senderUsername: sender ? sender.username : msg.senderId, // Include username for notifications
            });
          }
        }
      }

      // Note: Messages are now persisted and not deleted on reconnection
      // This allows for message history to be maintained
    });

    socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
      try {
        console.log('📤 Socket sendMessage received:', { senderId, receiverId, content: content.substring(0, 50) + '...' });
        console.log(`🔍 Current userSockets map size: ${userSockets.size}`);
        console.log(`🔍 Current userSockets entries:`, Array.from(userSockets.entries()));
        console.log(`🔍 Sender ${senderId} in userSockets:`, userSockets.has(senderId));
        
        // Use the encrypted message controller to send message
        const savedMessage = await sendMessage(senderId, receiverId, content);
        console.log('✅ Message saved successfully:', savedMessage._id);

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
            
            // Get sender information for notification
            const sender = await User.findOne({ profileId: senderId });
            
            decryptedMessage.timestamp = messageWithTime.timestamp;
            decryptedMessage.status = 'delivered';
            decryptedMessage.deliveredAt = new Date();
            decryptedMessage.senderUsername = sender ? sender.username : senderId; // Include username for notifications
            
            io.to(receiverSocketId).emit('receiveMessage', decryptedMessage);
            
            // Send notification to receiver
            await notifyNewMessage(receiverId, fullMessage);
            
            // Messages will persist until chat is closed
            // No automatic deletion - messages stay until user closes the chat
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
        
        // Update chat lists for both users
        await updateChatList(senderId, receiverId);
      } catch (error) {
        console.error('❌ Error sending encrypted message:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Notify sender about the error
        socket.emit('messageError', {
          error: 'Failed to send message',
          details: error.message
        });
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

    socket.on('closeChat', async ({ userId, friendId }) => {
      try {
        console.log(`🚪 Chat closed between ${userId} and ${friendId}`);
        console.log(`🔍 User socket ID: ${socket.id}`);
        console.log(`🔍 User in userSockets: ${userSockets.has(userId)}`);
        
        // Delete all messages between these two users
        const result = await Message.deleteMany({
          $or: [
            { senderId: userId, receiverId: friendId },
            { senderId: friendId, receiverId: userId }
          ]
        });
        
        console.log(`🗑️ Deleted ${result.deletedCount} messages from closed chat`);
        console.log(`🔍 Delete result:`, result);
        
        // Notify both users about message deletion
        const userSocketId = userSockets.get(userId);
        const friendSocketId = userSockets.get(friendId);
        
        console.log(`🔍 User socket ID: ${userSocketId}, Friend socket ID: ${friendSocketId}`);
        
        if (userSocketId) {
          io.to(userSocketId).emit('chatClosed', { 
            friendId: friendId, 
            deletedCount: result.deletedCount 
          });
          console.log(`📤 Sent chatClosed event to user ${userId}`);
        }
        
        if (friendSocketId) {
          io.to(friendSocketId).emit('chatClosed', { 
            friendId: userId, 
            deletedCount: result.deletedCount 
          });
          console.log(`📤 Sent chatClosed event to friend ${friendId}`);
        }
      } catch (error) {
        console.error('❌ Error closing chat and deleting messages:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
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

module.exports = { 
  initializeSocket, 
  userSockets, 
  io,
  notifyFriendRequest,
  notifyFriendAccept,
  notifyFriendReject,
  notifyFriendRemoval,
  notifyNewMessage,
  sendNotification,
  updateChatList
};
