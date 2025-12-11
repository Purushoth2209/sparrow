const messageRepository = require('../../repositories/message.repository');
const conversationRepository = require('../../repositories/conversation.repository');
const encryptService = require('./encrypt.service');
const { decompressBuffer } = require('../../utils/compression');
const messageStates = require('../../constants/messageStates');

/**
 * Sync Service
 * Handles message synchronization for offline users
 * 
 * ⚠️ CRITICAL BEHAVIOR:
 * - Does NOT requeue messages into queue
 * - Fetches directly from MongoDB
 * - Returns decrypted messages to client
 * - Client must sort by serverTimestamp (not queue order)
 * 
 * Queue is ONLY for real-time delivery via Socket.IO
 * Sync API is for offline/mobile users to fetch messages
 */

/**
 * Get messages since a specific timestamp
 * @param {string} profileId - User's profile ID
 * @param {Date} timestamp - Timestamp to sync from
 * @returns {Promise<Array>} Array of decrypted messages sorted by serverTimestamp ascending
 */
async function getMessagesSince(profileId, timestamp) {
  // Query messages with receiverId = profileId and serverTimestamp > since
  // Exclude already-read messages to prevent showing them again on refresh
  // Sort by serverTimestamp ascending for chronological order
  const messages = await messageRepository.findMessagesSince(profileId, timestamp);
  
  // Filter out read messages - only return unread or delivered messages
  // Keep sent messages (from current user) and unread/delivered messages (to current user)
  const unreadMessages = messages.filter(msg => 
    msg.status !== messageStates.READ || msg.senderId === profileId
  );
  
  // Decrypt and decompress all messages
  const decryptedMessages = await Promise.all(
    unreadMessages.map(async (message) => {
      try {
        if (message.isEncrypted) {
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
            uncompressedSize: undefined,
            messageId: message._id,
            serverTimestamp: message.serverTimestamp || message.timestamp
          };
        } else {
          const messageObj = message.toObject ? message.toObject() : message;
          return {
            ...messageObj,
            messageId: message._id,
            serverTimestamp: message.serverTimestamp || message.timestamp
          };
        }
      } catch (decryptError) {
        console.error(`❌ Failed to decrypt message ${message._id}:`, decryptError);
        const messageObj = message.toObject ? message.toObject() : message;
        return {
          ...messageObj,
          content: '[Message could not be decrypted]',
          decryptionError: true,
          messageId: message._id,
          serverTimestamp: message.serverTimestamp || message.timestamp
        };
      }
    })
  );

  return decryptedMessages;
}

/**
 * Get undelivered messages for a user
 * @param {string} profileId - User's profile ID
 * @returns {Promise<Array>} Array of undelivered messages
 */
async function getUndeliveredMessages(profileId) {
  return await messageRepository.findUndeliveredMessages(profileId);
}

/**
 * Get conversations with unread counts for a user
 * @param {string} profileId - User's profile ID
 * @returns {Promise<Array>} Array of conversations with unread counts
 */
async function getConversationsWithUnreadCounts(profileId) {
  const conversations = await conversationRepository.getConversationsForUser(profileId);
  
  return conversations.map(conv => ({
    conversationId: conv.conversationId,
    participants: conv.participants,
    lastMessageId: conv.lastMessageId,
    lastMessagePreview: conv.lastMessagePreview,
    lastMessageTimestamp: conv.lastMessageTimestamp,
    unreadCount: conv.unreadCounts.get(profileId) || 0
  }));
}

module.exports = {
  getMessagesSince,
  getUndeliveredMessages,
  getConversationsWithUnreadCounts
};
