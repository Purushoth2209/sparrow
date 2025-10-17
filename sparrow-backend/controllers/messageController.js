const Message = require('../models/Message');
const User = require('../models/User');
const OptimizedKMSEnvelopeEncryption = require('../utils/optimizedKmsEncryption');

// Initialize the optimized encryption service with DEK caching
const encryptionService = new OptimizedKMSEnvelopeEncryption({
  dekRotationInterval: 30 * 60 * 1000, // 30 minutes
  dekMaxAge: 60 * 60 * 1000, // 1 hour max age
  batchTimeout: 50, // 50ms batch window
  batchSize: 10 // Max 10 messages per batch
});

async function sendMessage(senderId, receiverId, content) {
  try {
    // Validate friendship before sending message
    const sender = await User.findOne({ profileId: senderId });
    if (!sender) {
      throw new Error('Sender not found');
    }

    if (!sender.friends.includes(receiverId)) {
      throw new Error('Cannot send message to non-friend user');
    }

    // Create session ID for DEK caching (based on sender-receiver pair)
    const sessionId = `${senderId}-${receiverId}`;

    // Encrypt the message content using optimized DEK caching
    const encryptedPackage = await encryptionService.encryptMessageOptimized(content, sessionId);

    // Create message with encrypted content
    const message = new Message({
      senderId,
      receiverId,
      // Store encrypted data instead of plain content
      isEncrypted: true,
      encryptedContent: encryptedPackage.encryptedContent,
      iv: encryptedPackage.iv,
      authTag: encryptedPackage.authTag,
      algorithm: encryptedPackage.algorithm,
      encryptedDEK: encryptedPackage.encryptedDEK,
      keyId: encryptedPackage.keyId,
      encryptionContext: encryptedPackage.encryptionContext,
      encryptionVersion: encryptedPackage.version,
      sessionId: encryptedPackage.sessionId, // Store session ID for optimized decryption
      timestamp: new Date(),
      status: 'sent'
    });

    await message.save();
    
    // Return message without sensitive encryption data for API response
    const responseMessage = message.toObject ? message.toObject() : message;
    delete responseMessage.encryptedDEK;
    delete responseMessage.encryptionContext;
    
    return responseMessage;
  } catch (err) {
    console.error('❌ Failed to send encrypted message:', err);
    throw err;
  }
}

async function updateMessageStatus(messageId, status) {
  try {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found');

    message.status = status;
    await message.save();
  } catch (err) {
    throw err;
  }
}

const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await User.findByIdAndUpdate(userId, { isOnline });
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieve and decrypt messages for a user
 * @param {string} userId - User's profile ID
 * @param {string} friendId - Friend's profile ID (optional, for conversation-specific messages)
 * @returns {Array} Array of decrypted messages
 */
async function getDecryptedMessages(userId, friendId = null) {
  try {
    // Build query for messages involving this user
    const query = {
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    };

    // If friendId is provided, filter for conversation with that friend
    if (friendId) {
      query.$and = [
        {
          $or: [
            { senderId: userId, receiverId: friendId },
            { senderId: friendId, receiverId: userId }
          ]
        }
      ];
    }

    // Retrieve messages from database
    const messages = await Message.find(query).sort({ timestamp: -1 });

    // Decrypt each message
    const decryptedMessages = await Promise.all(
      messages.map(async (message) => {
        try {
          if (message.isEncrypted) {
            // Create session ID for optimized decryption
            const sessionId = message.sessionId || `${message.senderId}-${message.receiverId}`;
            
            // Decrypt encrypted message using optimized service
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

            // Return message with decrypted content
            const messageObj = message.toObject ? message.toObject() : message;
            return {
              ...messageObj,
              content: decryptedContent,
              // Remove encryption fields from response
              encryptedContent: undefined,
              iv: undefined,
              authTag: undefined,
              algorithm: undefined,
              encryptedDEK: undefined,
              keyId: undefined,
              encryptionContext: undefined,
              isEncrypted: undefined
            };
          } else {
            // Return plain text message as-is (backward compatibility)
            return message.toObject ? message.toObject() : message;
          }
        } catch (decryptError) {
          console.error(`❌ Failed to decrypt message ${message._id}:`, decryptError);
          // Return message with error indicator
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
  } catch (error) {
    console.error('❌ Failed to retrieve encrypted messages:', error);
    throw new Error(`Message retrieval failed: ${error.message}`);
  }
}

/**
 * Decrypt a single message (for real-time display)
 * @param {Object} message - Message object from database
 * @returns {Object} Message with decrypted content
 */
async function decryptSingleMessage(message) {
  try {
    if (!message.isEncrypted) {
      return message; // Return as-is if not encrypted
    }

    // Create session ID for optimized decryption
    const sessionId = message.sessionId || `${message.senderId}-${message.receiverId}`;

    // Decrypt the message using optimized service
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

    // Return message with decrypted content
    const messageObj = message.toObject ? message.toObject() : message;
    return {
      ...messageObj,
      content: decryptedContent,
      // Remove encryption fields
      encryptedContent: undefined,
      iv: undefined,
      authTag: undefined,
      algorithm: undefined,
      encryptedDEK: undefined,
      keyId: undefined,
      encryptionContext: undefined,
      isEncrypted: undefined
    };
  } catch (error) {
    console.error('❌ Failed to decrypt single message:', error);
    const messageObj = message.toObject ? message.toObject() : message;
    return {
      ...messageObj,
      content: '[Message could not be decrypted]',
      decryptionError: true
    };
  }
}

/**
 * Send multiple messages in batch for improved performance
 * @param {Array} messages - Array of {senderId, receiverId, content} objects
 * @returns {Array} Array of saved messages
 */
async function sendBatchMessages(messages) {
  try {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required and cannot be empty');
    }

    // Group messages by sender-receiver pair for efficient DEK usage
    const messageGroups = new Map();
    
    for (const msg of messages) {
      const sessionId = `${msg.senderId}-${msg.receiverId}`;
      if (!messageGroups.has(sessionId)) {
        messageGroups.set(sessionId, []);
      }
      messageGroups.get(sessionId).push(msg);
    }

    const savedMessages = [];

    // Process each group
    for (const [sessionId, groupMessages] of messageGroups) {
      // Validate friendships for all messages in this group
      const senderId = groupMessages[0].senderId;
      const sender = await User.findOne({ profileId: senderId });
      if (!sender) {
        throw new Error(`Sender ${senderId} not found`);
      }

      // Batch encrypt messages for this session
      const encryptedMessages = await encryptionService.batchEncryptMessages(
        groupMessages.map(msg => ({ id: msg.id || Date.now(), content: msg.content })),
        sessionId
      );

      // Create and save messages
      for (let i = 0; i < groupMessages.length; i++) {
        const msg = groupMessages[i];
        const encryptedPackage = encryptedMessages[i];

        // Validate friendship
        if (!sender.friends.includes(msg.receiverId)) {
          throw new Error(`Cannot send message to non-friend user ${msg.receiverId}`);
        }

        const message = new Message({
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

        await message.save();
        
        // Return message without sensitive encryption data
        const responseMessage = message.toObject ? message.toObject() : message;
        delete responseMessage.encryptedDEK;
        delete responseMessage.encryptionContext;
        
        savedMessages.push(responseMessage);
      }
    }

    return savedMessages;
  } catch (err) {
    console.error('❌ Failed to send batch messages:', err);
    throw err;
  }
}

/**
 * Get encryption statistics for monitoring
 * @returns {Object} Encryption statistics
 */
async function getEncryptionStats() {
  try {
    const messageStats = await Message.getEncryptionStats();
    const optimizationStats = encryptionService.getStats();
    
    return {
      ...messageStats,
      optimization: optimizationStats
    };
  } catch (error) {
    console.error('❌ Failed to get encryption stats:', error);
    throw error;
  }
}

module.exports = {
  sendMessage,
  sendBatchMessages,
  updateMessageStatus,
  updateUserOnlineStatus,
  getDecryptedMessages,
  decryptSingleMessage,
  getEncryptionStats
};
