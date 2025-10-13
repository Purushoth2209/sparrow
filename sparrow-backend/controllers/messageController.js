const Message = require('../models/Message');
const User = require('../models/User');
const KMSEnvelopeEncryption = require('../utils/kmsEncryption');

// Initialize the encryption service
const encryptionService = new KMSEnvelopeEncryption();

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

    // Encrypt the message content using KMS envelope encryption
    const encryptedPackage = await encryptionService.encryptMessageComplete(content);

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
            // Decrypt encrypted message
            const decryptedContent = await encryptionService.decryptMessageComplete({
              encryptedContent: message.encryptedContent,
              iv: message.iv,
              authTag: message.authTag,
              algorithm: message.algorithm,
              encryptedDEK: message.encryptedDEK,
              keyId: message.keyId,
              encryptionContext: message.encryptionContext
            });

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

    // Decrypt the message
    const decryptedContent = await encryptionService.decryptMessageComplete({
      encryptedContent: message.encryptedContent,
      iv: message.iv,
      authTag: message.authTag,
      algorithm: message.algorithm,
      encryptedDEK: message.encryptedDEK,
      keyId: message.keyId,
      encryptionContext: message.encryptionContext
    });

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
 * Get encryption statistics for monitoring
 * @returns {Object} Encryption statistics
 */
async function getEncryptionStats() {
  try {
    return await Message.getEncryptionStats();
  } catch (error) {
    console.error('❌ Failed to get encryption stats:', error);
    throw error;
  }
}

module.exports = {
  sendMessage,
  updateMessageStatus,
  updateUserOnlineStatus,
  getDecryptedMessages,
  decryptSingleMessage,
  getEncryptionStats
};
