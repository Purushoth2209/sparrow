const Message = require('../../models/Message');
const User = require('../../models/User');
const { sendMessage, decryptSingleMessage } = require('../../controllers/message.controller');
const OptimizedKMSEnvelopeEncryption = require('../../utils/optimizedKmsEncryption');

// Initialize optimized encryption service for socket operations
const socketEncryptionService = new OptimizedKMSEnvelopeEncryption({
  dekRotationInterval: 30 * 60 * 1000, // 30 minutes
  dekMaxAge: 60 * 60 * 1000, // 1 hour max age
  batchTimeout: 50, // 50ms batch window
  batchSize: 10 // Max 10 messages per batch
});

/**
 * Message Handler
 * Handles real-time message sending and delivery via Socket.IO
 */

/**
 * Handle sending a message via socket
 */
const handleSendMessage = async (socket, io, userSockets, { senderId, receiverId, content }) => {
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
};

/**
 * Handle message delivery acknowledgment
 */
const handleMessageDelivered = async (socket, io, userSockets, { messageId, receiverId }) => {
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
};

/**
 * Handle marking messages as read
 */
const handleMarkMessagesAsRead = async (socket, io, userSockets, { senderId, receiverId }) => {
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
};

/**
 * Deliver undelivered messages on connection
 */
const deliverUndeliveredMessages = async (socket, userSockets, profileId) => {
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
          const { io: getIO } = require('../index');
          const socketIO = getIO();
          if (socketIO) {
            socketIO.to(senderSocketId).emit('messageStatusUpdate', {
              messageId: msg._id,
              status: 'delivered',
              deliveredAt: new Date()
            });
          }
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
};

module.exports = {
  handleSendMessage,
  handleMessageDelivered,
  handleMarkMessagesAsRead,
  deliverUndeliveredMessages,
  socketEncryptionService
};

