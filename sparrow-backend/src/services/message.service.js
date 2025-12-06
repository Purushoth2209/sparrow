const messageRepository = require('../repositories/message.repository');
const userRepository = require('../repositories/user.repository');
const OptimizedKMSEnvelopeEncryption = require('../utils/optimizedKmsEncryption');

// Initialize the optimized encryption service with DEK caching
const encryptionService = new OptimizedKMSEnvelopeEncryption({
  dekRotationInterval: 30 * 60 * 1000, // 30 minutes
  dekMaxAge: 60 * 60 * 1000, // 1 hour max age
  batchTimeout: 50, // 50ms batch window
  batchSize: 10 // Max 10 messages per batch
});

/**
 * Message Service
 * Contains business logic for messages
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

async function sendMessage(senderId, receiverId, content) {
  // Validate friendship before sending message
  const sender = await userRepository.findUserByProfileId(senderId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  if (!sender.friends.includes(receiverId)) {
    throw new Error('Cannot send message to non-friend user');
  }

  // Check if users are blocked
  const blockingStatus = await checkBlockingStatus(senderId, receiverId);
  if (blockingStatus.isBlocked) {
    throw new Error(blockingStatus.message);
  }

  // Create session ID for DEK caching (based on sender-receiver pair)
  const sessionId = `${senderId}-${receiverId}`;

  // Encrypt the message content using optimized DEK caching
  const encryptedPackage = await encryptionService.encryptMessageOptimized(content, sessionId);

  // Create message with encrypted content
  const message = await messageRepository.createMessage({
    senderId,
    receiverId,
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
    status: 'sent'
  });
  
  // Return message without sensitive encryption data for API response
  const responseMessage = message.toObject ? message.toObject() : message;
  delete responseMessage.encryptedDEK;
  delete responseMessage.encryptionContext;
  
  return responseMessage;
}

async function decryptSingleMessage(message) {
  if (!message.isEncrypted) {
    return message;
  }

  const sessionId = message.sessionId || `${message.senderId}-${message.receiverId}`;

  const decryptedContent = await encryptionService.decryptMessageOptimized({
    encryptedContent: message.encryptedContent,
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
    iv: undefined,
    authTag: undefined,
    algorithm: undefined,
    encryptedDEK: undefined,
    keyId: undefined,
    encryptionContext: undefined,
    isEncrypted: undefined
  };
}

async function getDecryptedMessages(userId, friendId = null) {
  // If friendId is provided, check blocking status before retrieving messages
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

async function sendBatchMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required and cannot be empty');
  }

  const messageGroups = new Map();
  
  for (const msg of messages) {
    const sessionId = `${msg.senderId}-${msg.receiverId}`;
    if (!messageGroups.has(sessionId)) {
      messageGroups.set(sessionId, []);
    }
    messageGroups.get(sessionId).push(msg);
  }

  const savedMessages = [];

  for (const [sessionId, groupMessages] of messageGroups) {
    const senderId = groupMessages[0].senderId;
    const sender = await userRepository.findUserByProfileId(senderId);
    if (!sender) {
      throw new Error(`Sender ${senderId} not found`);
    }

    const encryptedMessages = await encryptionService.batchEncryptMessages(
      groupMessages.map(msg => ({ id: msg.id || Date.now(), content: msg.content })),
      sessionId
    );

    for (let i = 0; i < groupMessages.length; i++) {
      const msg = groupMessages[i];
      const encryptedPackage = encryptedMessages[i];

      if (!sender.friends.includes(msg.receiverId)) {
        throw new Error(`Cannot send message to non-friend user ${msg.receiverId}`);
      }

      // Check if users are blocked
      const blockingStatus = await checkBlockingStatus(msg.senderId, msg.receiverId);
      if (blockingStatus.isBlocked) {
        throw new Error(blockingStatus.message);
      }

      const message = await messageRepository.createMessage({
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
        status: 'sent'
      });
      
      const responseMessage = message.toObject ? message.toObject() : message;
      delete responseMessage.encryptedDEK;
      delete responseMessage.encryptionContext;
      
      savedMessages.push(responseMessage);
    }
  }

  return savedMessages;
}

async function updateMessageStatus(messageId, status) {
  return await messageRepository.updateMessageStatus(messageId, status);
}

async function markMessagesAsRead(senderId, receiverId) {
  // Check if users are blocked before marking messages as read
  const blockingStatus = await checkBlockingStatus(senderId, receiverId);
  if (blockingStatus.isBlocked) {
    throw new Error(blockingStatus.message);
  }

  return await messageRepository.updateMessagesStatus(
    { 
      senderId: senderId, 
      receiverId: receiverId, 
      status: { $ne: 'read' } 
    },
    'read',
    { readAt: new Date() }
  );
}

async function getEncryptionStats() {
  const messageStats = await messageRepository.getEncryptionStats();
  const optimizationStats = encryptionService.getStats();
  
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
  encryptionService
};

