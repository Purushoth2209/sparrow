const messageRepository = require('../../repositories/message.repository');
const userRepository = require('../../repositories/user.repository');
const tempIdRepository = require('../../repositories/tempId.repository');
const conversationRepository = require('../../repositories/conversation.repository');
const encryptService = require('./encrypt.service');
const deliveryService = require('./delivery.service');
const syncService = require('./sync.service');
const { addMessageJob } = require('../../queue/message.queue');
const { addNotificationJob } = require('../../queue/notification.queue');
const { compressBuffer, decompressBuffer } = require('../../utils/compression');
const messageConfig = require('../../config/message');
const messageStates = require('../../constants/messageStates');

/**
 * Message Service
 * Core message business logic - unified for both Socket.IO and HTTP
 */

/**
 * Check if users are blocked (bidirectional check)
 * @param {string} userId1 - First user's profileId
 * @param {string} userId2 - Second user's profileId
 * @returns {Promise<{isBlocked: boolean, message: string}>}
 */
async function checkBlockingStatus(userId1, userId2) {
  const user1 = await userRepository.findUserByProfileId(userId1);
  const user2 = await userRepository.findUserByProfileId(userId2);

  if (!user1 || !user2) {
    throw new Error('User not found');
  }

  // Check if user1 has blocked user2
  const user1BlockedUser2 = user1.blockedUsers?.some(
    blocked => blocked.profileId === userId2
  );

  // Check if user2 has blocked user1
  const user2BlockedUser1 = user2.blockedUsers?.some(
    blocked => blocked.profileId === userId1
  );

  if (user1BlockedUser2) {
    return { isBlocked: true, message: 'Cannot send message to blocked user' };
  }

  if (user2BlockedUser1) {
    return { isBlocked: true, message: 'Cannot send message. You have been blocked by this user' };
  }

  return { isBlocked: false, message: null };
}

/**
 * Unified sendMessage function
 * Used by both Socket.IO and HTTP endpoints
 * @param {Object} params - Message parameters
 * @param {string} params.senderId - Sender's profile ID
 * @param {string} params.receiverId - Receiver's profile ID
 * @param {string} params.content - Message content (plain text)
 * @param {string} [params.tempId] - Temporary ID for deduplication
 * @returns {Promise<Object>} Saved message (without sensitive encryption data)
 */
async function sendMessage({ senderId, receiverId, content, tempId }) {
  // 1. Validate sender exists
  const sender = await userRepository.findUserByProfileId(senderId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  // 2. Validate friendship
  if (!sender.friends.includes(receiverId)) {
    throw new Error('Cannot send message to non-friend user');
  }

  // 3. Check blocking status
  const blockingStatus = await checkBlockingStatus(senderId, receiverId);
  if (blockingStatus.isBlocked) {
    throw new Error(blockingStatus.message);
  }

  // 4. Deduplication check using tempId mapping (if tempId provided)
  if (tempId) {
    const existingMapping = await tempIdRepository.getMapping(tempId, senderId);
    if (existingMapping) {
      // Get existing message
      const existingMessage = await messageRepository.findMessageById(existingMapping.messageId);
      if (existingMessage) {
        // Return existing message to prevent duplicates
        const responseMessage = existingMessage.toObject ? existingMessage.toObject() : existingMessage;
        delete responseMessage.encryptedDEK;
        delete responseMessage.encryptionContext;
        delete responseMessage.compressedContent;
        return {
          ...responseMessage,
          messageId: existingMessage._id,
          status: existingMessage.status,
          serverTimestamp: existingMessage.serverTimestamp || existingMessage.timestamp
        };
      }
    }
  }

  // 5. Create session ID for DEK caching
  const sessionId = `${senderId}-${receiverId}`;

  // 6. Encrypt message content
  const encryptedPackage = await encryptService.encryptContent(content, sessionId);

  // 7. Compress encrypted content (compress the hex string as buffer)
  const encryptedContentBuffer = Buffer.from(encryptedPackage.encryptedContent, 'hex');
  const compressionResult = await compressBuffer(encryptedContentBuffer, messageConfig.compressionAlgorithm);

  // 8. Set timestamps
  const serverTimestamp = new Date();
  const expireAt = new Date(serverTimestamp.getTime() + messageConfig.messageTTLDays * 24 * 60 * 60 * 1000);

  // 9. Save message to database
  const message = await messageRepository.saveMessage({
    senderId,
    receiverId,
    isEncrypted: true,
    encryptedContent: encryptedPackage.encryptedContent, // Keep for backward compatibility
    compressedContent: compressionResult.compressedBuffer, // Compressed encrypted content
    compressionType: compressionResult.compressionType,
    uncompressedSize: compressionResult.uncompressedSize,
    iv: encryptedPackage.iv,
    authTag: encryptedPackage.authTag,
    algorithm: encryptedPackage.algorithm,
    encryptedDEK: encryptedPackage.encryptedDEK,
    keyId: encryptedPackage.keyId,
    encryptionContext: encryptedPackage.encryptionContext,
    encryptionVersion: encryptedPackage.version,
    sessionId: encryptedPackage.sessionId,
    timestamp: serverTimestamp, // Legacy field
    serverTimestamp: serverTimestamp,
    expireAt: expireAt,
    status: messageConfig.messageStatus.SENT,
    tempId: tempId // Store tempId for deduplication
  });

  // 10. Create tempId mapping (if tempId provided)
  if (tempId) {
    try {
      await tempIdRepository.createMapping(tempId, senderId, message._id);
    } catch (error) {
      // Mapping might already exist (race condition), continue
      console.warn(`⚠️ Failed to create tempId mapping (may already exist): ${error.message}`);
    }
  }

  // 11. Update or create conversation
  try {
    const conversation = await conversationRepository.findOrCreateConversation(senderId, receiverId);
    const messagePreview = content.length > 50 ? content.substring(0, 50) + '...' : content;
    
    await conversationRepository.updateConversation(conversation.conversationId, {
      lastMessageId: message._id,
      lastMessagePreview: messagePreview,
      lastMessageTimestamp: serverTimestamp
    });
    
    // Increment unread count for receiver
    await conversationRepository.incrementUnreadCount(conversation.conversationId, receiverId);
  } catch (error) {
    console.error('❌ Error updating conversation:', error);
    // Continue even if conversation update fails
  }

  // 12. Push job to message queue for async delivery (if Redis available)
  await addMessageJob({
    messageId: message._id.toString(),
    senderId,
    receiverId,
    priority: 1
  });

  // 13. ⚠️ ALWAYS enqueue notification job - even if receiver is online
  // This ensures push notifications are sent when app is backgrounded
  // Socket.IO delivery is additional, not a replacement for notifications
  await addNotificationJob({
    type: 'message',
    receiverId: receiverId,
    senderId: senderId,
    messageId: message._id.toString(),
    priority: 1
  });

  // 14. Return message without sensitive encryption data
  const responseMessage = message.toObject ? message.toObject() : message;
  delete responseMessage.encryptedDEK;
  delete responseMessage.encryptionContext;
  delete responseMessage.compressedContent;
  
  return {
    ...responseMessage,
    messageId: message._id,
    status: message.status,
    serverTimestamp: message.serverTimestamp
  };
}

/**
 * Decrypt single message
 * @param {Object} message - Message object from database
 * @returns {Promise<Object>} Decrypted message
 */
async function decryptSingleMessage(message) {
  if (!message.isEncrypted) {
    return message;
  }

  const sessionId = message.sessionId || `${message.senderId}-${message.receiverId}`;

  let encryptedContentHex;
  
  // Check if message is compressed
  if (message.compressedContent && message.compressionType) {
    // Decompress first
    const decompressedBuffer = await decompressBuffer(
      message.compressedContent,
      message.compressionType
    );
    // Convert buffer to hex for decryption
    encryptedContentHex = decompressedBuffer.toString('hex');
  } else {
    // Legacy: use encryptedContent directly
    encryptedContentHex = message.encryptedContent;
  }

  // Decrypt the content
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
  return {
    ...messageObj,
    content: decryptedContent,
    encryptedContent: undefined,
    compressedContent: undefined,
    iv: undefined,
    authTag: undefined,
    algorithm: undefined,
    encryptedDEK: undefined,
    keyId: undefined,
    encryptionContext: undefined,
    isEncrypted: undefined,
    compressionType: undefined,
    uncompressedSize: undefined
  };
}

/**
 * Get decrypted messages
 * @param {string} userId - User's profile ID
 * @param {string} [friendId] - Optional friend ID to filter messages
 * @returns {Promise<Array>} Array of decrypted messages
 */
async function getDecryptedMessages(userId, friendId = null) {
  // If friendId is provided, check blocking status
  if (friendId) {
    const blockingStatus = await checkBlockingStatus(userId, friendId);
    if (blockingStatus.isBlocked) {
      throw new Error(blockingStatus.message);
    }
  }

  const messages = await messageRepository.findMessagesByUsers(userId, friendId);

  const decryptedMessages = await Promise.all(
    messages.map(async (message) => {
      try {
        if (message.isEncrypted) {
          return await decryptSingleMessage(message);
        } else {
          return message.toObject ? message.toObject() : message;
        }
      } catch (decryptError) {
        console.error(`❌ Failed to decrypt message ${message._id}:`, decryptError);
        const messageObj = message.toObject ? message.toObject() : message;
        return {
          ...messageObj,
          content: '[Message could not be decrypted]',
          decryptionError: true
        };
      }
    })
  );

  return decryptedMessages;
}

/**
 * Send batch messages
 * @param {Array} messages - Array of message objects with senderId, receiverId, content
 * @returns {Promise<Array>} Array of saved messages
 */
async function sendBatchMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required and cannot be empty');
  }

  const messageGroups = new Map();
  
  // Group messages by session (sender-receiver pair)
  for (const msg of messages) {
    const sessionId = `${msg.senderId}-${msg.receiverId}`;
    if (!messageGroups.has(sessionId)) {
      messageGroups.set(sessionId, []);
    }
    messageGroups.get(sessionId).push(msg);
  }

  const savedMessages = [];

  // Process each session group
  for (const [sessionId, groupMessages] of messageGroups) {
    const senderId = groupMessages[0].senderId;
    const sender = await userRepository.findUserByProfileId(senderId);
    if (!sender) {
      throw new Error(`Sender ${senderId} not found`);
    }

    // Batch encrypt messages for this session
    const encryptedMessages = await encryptService.batchEncryptMessages(
      groupMessages.map(msg => ({ id: msg.id || Date.now(), content: msg.content })),
      sessionId
    );

    // Save each message
    for (let i = 0; i < groupMessages.length; i++) {
      const msg = groupMessages[i];
      const encryptedPackage = encryptedMessages[i];

      // Validate friendship
      if (!sender.friends.includes(msg.receiverId)) {
        throw new Error(`Cannot send message to non-friend user ${msg.receiverId}`);
      }

      // Check blocking
      const blockingStatus = await checkBlockingStatus(msg.senderId, msg.receiverId);
      if (blockingStatus.isBlocked) {
        throw new Error(blockingStatus.message);
      }

      // Save message
      const message = await messageRepository.saveMessage({
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        isEncrypted: true,
        encryptedContent: encryptedPackage.encryptedContent,
        iv: encryptedPackage.iv,
        authTag: encryptedPackage.authTag,
        algorithm: encryptedPackage.algorithm,
        encryptedDEK: encryptedPackage.encryptedDEK,
        keyId: encryptedPackage.keyId,
        encryptionContext: encryptedPackage.encryptionContext,
        encryptionVersion: encryptedPackage.version,
        sessionId: encryptedPackage.sessionId,
        timestamp: new Date(),
        status: messageStates.SENT
      });
      
      // Add to queue (if Redis available)
      await addMessageJob({
        messageId: message._id.toString(),
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        priority: 1
      });
      
      const responseMessage = message.toObject ? message.toObject() : message;
      delete responseMessage.encryptedDEK;
      delete responseMessage.encryptionContext;
      
      savedMessages.push(responseMessage);
    }
  }

  return savedMessages;
}

/**
 * Update message status
 * @param {string} messageId - Message ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated message
 */
async function updateMessageStatus(messageId, status) {
  return await messageRepository.updateMessageStatus(messageId, status);
}

/**
 * Mark messages as read
 * @param {string} senderId - Sender's profile ID
 * @param {string} receiverId - Receiver's profile ID
 * @returns {Promise<Object>} Update result
 */
async function markMessagesAsRead(senderId, receiverId) {
  return await deliveryService.markRead(senderId, receiverId);
}

/**
 * Get encryption statistics
 * @returns {Promise<Object>} Encryption stats
 */
async function getEncryptionStats() {
  const messageStats = await messageRepository.getEncryptionStats();
  const optimizationStats = encryptService.getEncryptionStats();
  
  return {
    ...messageStats,
    optimization: optimizationStats
  };
}

module.exports = {
  sendMessage,
  sendBatchMessages,
  updateMessageStatus,
  getDecryptedMessages,
  decryptSingleMessage,
  markMessagesAsRead,
  getEncryptionStats,
  checkBlockingStatus,
  // Export services for backward compatibility
  deliveryService,
  syncService,
  encryptService
};

