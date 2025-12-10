const Message = require('../../models/Message');
const User = require('../../models/User');
const messageService = require('../../services/message/message.service');
const deliveryService = require('../../services/message/delivery.service');
const syncService = require('../../services/message/sync.service');
const { io, userSockets } = require('../../socket');
const messageStates = require('../../constants/messageStates');

/**
 * Message Handler
 * Handles real-time message sending and delivery via Socket.IO
 * All business logic is delegated to messageService
 */

/**
 * Handle sending a message via socket
 */
const handleSendMessage = async (socket, io, userSockets, { senderId, receiverId, content, tempId }) => {
  try {
    // Use unified message service
    const savedMessage = await messageService.sendMessage({ senderId, receiverId, content, tempId });

    // Keep timestamp as ISO string for frontend timezone handling
    const messageWithTime = {
      ...savedMessage,
      timestamp: new Date(savedMessage.timestamp).toISOString(),
    };

    // Check if receiver is online and deliver immediately
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      // Get the full message from database for decryption
      const fullMessage = await Message.findById(savedMessage._id);
      if (fullMessage) {
        // Decrypt message for real-time display to receiver
        const decryptedMessage = await messageService.decryptSingleMessage(fullMessage);
        decryptedMessage.timestamp = messageWithTime.timestamp;
        
        // Get sender's username for display
        const sender = await User.findOne({ profileId: senderId });
        decryptedMessage.senderUsername = sender ? sender.username : 'Unknown User';
        
        // Emit notification event to receiver
        console.log('🔔 Emitting messageReceivedNotification event:', {
          senderId: senderId,
          senderName: sender ? sender.username : 'Unknown User',
          senderProfileImage: sender ? sender.profileImage : null,
          messagePreview: decryptedMessage.content ? decryptedMessage.content.substring(0, 30) : 'Message',
          timestamp: new Date(),
          messageId: savedMessage._id
        });
        
        io.to(receiverSocketId).emit('messageReceivedNotification', {
          senderId: senderId,
          senderName: sender ? sender.username : 'Unknown User',
          senderProfileImage: sender ? sender.profileImage : null,
          messagePreview: decryptedMessage.content ? decryptedMessage.content.substring(0, 30) : 'Message',
          timestamp: new Date(),
          messageId: savedMessage._id,
          fullMessage: decryptedMessage
        });
        
        // Mark as delivered and emit message
        await deliveryService.markDelivered(savedMessage._id);
        decryptedMessage.status = messageStates.DELIVERED;
        decryptedMessage.deliveredAt = new Date();
        
        io.to(receiverSocketId).emit('receiveMessage', decryptedMessage);
        
        // Message is persisted for 7 days (TTL) - no deletion
      }
      
      // Notify sender that message was delivered
      await deliveryService.notifySenderOfStatus(senderId, {
        type: 'messageStatusUpdate',
        messageId: savedMessage._id,
        status: messageStates.DELIVERED,
        deliveredAt: new Date()
      });
    } else {
      // Receiver is offline, notify sender that message was sent
      await deliveryService.notifySenderOfStatus(senderId, {
        type: 'messageStatusUpdate',
        messageId: savedMessage._id,
        status: messageStates.SENT,
        sentAt: new Date()
      });
    }
    
    // Send decrypted message back to sender for display
    const fullMessage = await Message.findById(savedMessage._id);
    if (fullMessage) {
      const decryptedMessageForSender = await messageService.decryptSingleMessage(fullMessage);
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
    
    // Mark message as delivered (message persists for 7 days TTL)
    const message = await Message.findById(messageId);
    if (message) {
      // Update status to delivered if not already
      if (message.status !== messageStates.DELIVERED) {
        await deliveryService.markDelivered(messageId);
      }
      
      // Notify sender that message was delivered
      await deliveryService.notifySenderOfStatus(message.senderId, {
        type: 'messageStatusUpdate',
        messageId: messageId,
        status: messageStates.DELIVERED,
        deliveredAt: new Date()
      });
      
      console.log(`✅ Message ${messageId} marked as delivered (persisted for 7 days)`);
    } else {
      console.log(`⚠️ Message ${messageId} not found`);
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
    
    // Use delivery service to mark as read
    await deliveryService.markRead(senderId, receiverId);
    
    // Get recent read messages for individual status updates
    const readMessages = await Message.find({
      senderId: senderId,
      receiverId: receiverId,
      status: messageStates.READ
    }).sort({ timestamp: -1 }).limit(10);
    
    // Send individual status updates
    const senderSocketId = userSockets.get(senderId);
    if (senderSocketId) {
      readMessages.forEach(msg => {
        io.to(senderSocketId).emit('messageStatusUpdate', {
          messageId: msg._id,
          status: messageStates.READ,
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
  try {
    // Get undelivered messages using sync service
    const undeliveredMessages = await syncService.getUndeliveredMessages(profileId);
    
    console.log(`🔍 DEBUG: Found ${undeliveredMessages.length} undelivered messages for user ${profileId}`);
    
    if (undeliveredMessages.length > 0) {
      console.log(`📨 Delivering ${undeliveredMessages.length} undelivered messages to ${profileId}`);
      
      const deliveredMessageIds = [];
      
      // Process each undelivered message
      for (const msg of undeliveredMessages) {
        try {
          // Decrypt the message
          const decryptedMessage = await messageService.decryptSingleMessage(msg);
          
          // Get sender's username
          const sender = await User.findOne({ profileId: msg.senderId });
          
          const messageWithTime = {
            ...decryptedMessage,
            timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            senderUsername: sender ? sender.username : 'Unknown User',
            isDeliveredOnConnect: true
          };
          
          // Emit notification event
          console.log('🔔 Emitting messageReceivedNotification event for undelivered message:', {
            senderId: msg.senderId,
            senderName: sender ? sender.username : 'Unknown User',
            senderProfileImage: sender ? sender.profileImage : null,
            messagePreview: decryptedMessage.content ? decryptedMessage.content.substring(0, 30) : 'Message',
            timestamp: new Date(),
            messageId: msg._id
          });
          
          socket.emit('messageReceivedNotification', {
            senderId: msg.senderId,
            senderName: sender ? sender.username : 'Unknown User',
            senderProfileImage: sender ? sender.profileImage : null,
            messagePreview: decryptedMessage.content ? decryptedMessage.content.substring(0, 30) : 'Message',
            timestamp: new Date(),
            messageId: msg._id,
            fullMessage: messageWithTime
          });
          
          socket.emit('receiveMessage', messageWithTime);
          
          // Mark as delivered
          await deliveryService.markDelivered(msg._id);
          deliveredMessageIds.push(msg._id);
          
          // Notify sender
          const senderSocketId = userSockets.get(msg.senderId);
          if (senderSocketId) {
            const { io: getIO } = require('../index');
            const socketIO = getIO();
            if (socketIO) {
              await deliveryService.notifySenderOfStatus(msg.senderId, {
                type: 'messageStatusUpdate',
                messageId: msg._id,
                status: messageStates.DELIVERED,
                deliveredAt: new Date()
              });
            }
          }
        } catch (decryptError) {
          console.error(`❌ Failed to decrypt undelivered message ${msg._id}:`, decryptError);
          socket.emit('receiveMessage', {
            ...msg.toObject(),
            content: '[Message could not be decrypted]',
            decryptionError: true,
            timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            isDeliveredOnConnect: true
          });
        }
      }
      
      // Messages are persisted for 7 days (TTL) - no deletion needed
      console.log(`✅ Delivered ${deliveredMessageIds.length} messages to user ${profileId} (persisted for 7 days)`);
    } else {
      console.log(`📭 No undelivered messages for ${profileId}`);
    }
  } catch (error) {
    console.error('❌ Error delivering undelivered messages:', error);
  }
};

module.exports = {
  handleSendMessage,
  handleMessageDelivered,
  handleMarkMessagesAsRead,
  deliverUndeliveredMessages
};
