const messageRepository = require('../../repositories/message.repository');
const userRepository = require('../../repositories/user.repository');
const conversationRepository = require('../../repositories/conversation.repository');
const encryptService = require('./encrypt.service');
const { decompressBuffer } = require('../../utils/compression');
const Conversation = require('../../models/Conversation');
const messageStates = require('../../constants/messageStates');

// Lazy-load socket to avoid circular dependency
function getSocketIO() {
  const { io } = require('../../socket');
  return io();
}

function getUserSockets() {
  const { userSockets } = require('../../socket');
  return userSockets;
}

/**
 * Delivery Service
 * Handles message delivery status updates and notifications
 */

/**
 * Mark message as delivered
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>} Updated message
 */
async function markDelivered(messageId) {
  return await messageRepository.updateMessageStatus(messageId, messageStates.DELIVERED, {
    deliveredAt: new Date()
  });
}

/**
 * Mark messages as read
 * @param {string} senderId - Sender's profile ID
 * @param {string} receiverId - Receiver's profile ID
 * @returns {Promise<Object>} Update result with modifiedCount
 */
async function markRead(senderId, receiverId) {
  // Check blocking status before marking as read
  const sender = await userRepository.findUserByProfileId(senderId);
  const receiver = await userRepository.findUserByProfileId(receiverId);
  
  if (!sender || !receiver) {
    throw new Error('User not found');
  }

  // Check if receiver has blocked sender
  const receiverBlockedSender = receiver.blockedUsers?.some(
    blocked => blocked.profileId === senderId
  );
  if (receiverBlockedSender) {
    throw new Error('Cannot mark messages as read. You have been blocked by this user');
  }

  const result = await messageRepository.updateMessagesStatus(
    { 
      senderId: senderId, 
      receiverId: receiverId, 
      status: { $ne: messageStates.READ } 
    },
    messageStates.READ,
    { readAt: new Date() }
  );

  // Reset unread count in conversation
  try {
    const conversationId = Conversation.getConversationId(senderId, receiverId);
    await conversationRepository.resetUnreadCount(conversationId, receiverId);
  } catch (convError) {
    console.warn('⚠️ Failed to reset unread count in conversation:', convError.message);
    // Continue even if conversation update fails
  }

  // Notify sender via Socket.IO
  await notifySenderOfStatus(senderId, {
    type: 'messagesRead',
    receiverId: receiverId,
    readAt: new Date(),
    messageCount: result.modifiedCount
  });

  return result;
}

/**
 * Notify sender of message status update
 * @param {string} senderId - Sender's profile ID
 * @param {Object} statusData - Status update data
 * @returns {Promise<void>}
 */
async function notifySenderOfStatus(senderId, statusData) {
  const socketIO = getSocketIO();
  const userSockets = getUserSockets();
  const senderSocketId = userSockets.get(senderId);
  
  if (senderSocketId && socketIO) {
    if (statusData.type === 'messagesRead') {
      socketIO.to(senderSocketId).emit('messagesRead', {
        receiverId: statusData.receiverId,
        readAt: statusData.readAt,
        messageCount: statusData.messageCount
      });
    } else if (statusData.type === 'messageStatusUpdate') {
      socketIO.to(senderSocketId).emit('messageStatusUpdate', {
        messageId: statusData.messageId,
        status: statusData.status,
        deliveredAt: statusData.deliveredAt,
        readAt: statusData.readAt,
        deleted: statusData.deleted
      });
    }
  }
}

/**
 * Deliver message to receiver via Socket.IO
 * @param {Object} message - Message object (from database)
 * @param {string} receiverId - Receiver's profile ID
 * @returns {Promise<void>}
 */
async function deliverMessageToReceiver(message, receiverId) {
  const socketIO = getSocketIO();
  const userSockets = getUserSockets();
  const receiverSocketId = userSockets.get(receiverId);
  
  if (!receiverSocketId || !socketIO) {
    return; // Receiver not online
  }

  try {
    // Decrypt message for display
    const User = require('../../models/User');
    
    const sessionId = message.sessionId || `${message.senderId}-${message.receiverId}`;
    
    // Decompress if compressed
    let encryptedContentHex;
    if (message.compressedContent && message.compressionType) {
      const decompressedBuffer = await decompressBuffer(
        message.compressedContent,
        message.compressionType
      );
      encryptedContentHex = decompressedBuffer.toString('hex');
    } else {
      encryptedContentHex = message.encryptedContent;
    }
    
    // Decrypt
    const decryptedContent = await encryptService.decryptContent({
      encryptedContent: encryptedContentHex,
      iv: message.iv,
      authTag: message.authTag,
      algorithm: message.algorithm,
      encryptedDEK: message.encryptedDEK,
      keyId: message.keyId,
      encryptionContext: message.encryptionContext,
      sessionId: message.sessionId
    }, sessionId);

    const messageObj = message.toObject ? message.toObject() : message;
    const decryptedMessage = {
      ...messageObj,
      content: decryptedContent,
      encryptedContent: undefined,
      iv: undefined,
      authTag: undefined,
      algorithm: undefined,
      encryptedDEK: undefined,
      keyId: undefined,
      encryptionContext: undefined,
      isEncrypted: undefined
    };

    // Get sender's username for display
    const sender = await User.findOne({ profileId: message.senderId });
    decryptedMessage.senderUsername = sender ? sender.username : 'Unknown User';
    decryptedMessage.timestamp = new Date(message.timestamp).toISOString();

    // Emit notification event
    socketIO.to(receiverSocketId).emit('messageReceivedNotification', {
      senderId: message.senderId,
      senderName: sender ? sender.username : 'Unknown User',
      senderProfileImage: sender ? sender.profileImage : null,
      messagePreview: decryptedContent ? decryptedContent.substring(0, 30) : 'Message',
      timestamp: new Date(),
      messageId: message._id,
      fullMessage: decryptedMessage
    });

    // Emit actual message
    socketIO.to(receiverSocketId).emit('receiveMessage', decryptedMessage);

    // Mark as delivered
    await markDelivered(message._id);
  } catch (error) {
    console.error(`❌ Error delivering message ${message._id} to ${receiverId}:`, error);
    throw error;
  }
}

module.exports = {
  markDelivered,
  markRead,
  notifySenderOfStatus,
  deliverMessageToReceiver
};

