const conversationRepository = require('../repositories/conversation.repository');
const userRepository = require('../repositories/user.repository');

/**
 * Conversation Service
 * Contains business logic for conversations
 */

/**
 * Enrich conversation with participant details
 * @param {Object} conversation - Conversation object from database
 * @param {string} userId - Current user's ID
 * @returns {Promise<Object>} Enriched conversation object
 */
async function enrichConversation(conversation, userId) {
  const otherParticipantId = conversation.participants.find(p => p !== userId);
  const otherParticipant = await userRepository.findUserByProfileId(otherParticipantId);
  
  const userSettings = conversation.userSettings.get(userId) || {
    muted: false,
    archived: false,
    mutedAt: null,
    archivedAt: null
  };

  const unreadCount = conversation.unreadCounts.get(userId) || 0;

  return {
    conversationId: conversation.conversationId,
    participant: otherParticipant ? {
      profileId: otherParticipant.profileId,
      username: otherParticipant.username,
      fullName: otherParticipant.fullName,
      profileImage: otherParticipant.profileImage,
      isOnline: otherParticipant.isOnline || false,
      lastSeen: otherParticipant.lastSeen
    } : null,
    lastMessageId: conversation.lastMessageId,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageTimestamp: conversation.lastMessageTimestamp,
    unreadCount,
    userSettings: {
      muted: userSettings.muted,
      archived: userSettings.archived,
      mutedAt: userSettings.mutedAt,
      archivedAt: userSettings.archivedAt
    },
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

/**
 * List all conversations for a user with enrichment
 * @param {string} userId - User's profile ID
 * @param {Object} options - Query options (limit, offset, includeArchived)
 * @returns {Promise<Array>} Array of enriched conversations
 */
async function listUserConversations(userId, options = {}) {
  const { limit = 50, offset = 0, includeArchived = false } = options;

  const conversations = await conversationRepository.getConversationsForUser(userId, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    includeArchived: includeArchived === 'true'
  });

  // Enrich all conversations with participant details
  const enrichedConversations = await Promise.all(
    conversations.map(conv => enrichConversation(conv, userId))
  );

  return enrichedConversations;
}

/**
 * Get a specific conversation by ID with enrichment
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - Current user's ID
 * @returns {Promise<Object>} Enriched conversation object
 * @throws {Error} If conversation not found or user is not a participant
 */
async function getConversationById(conversationId, userId) {
  const conversation = await conversationRepository.getConversationById(conversationId);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Check if user is a participant
  if (!conversation.participants.includes(userId)) {
    throw new Error('Access denied');
  }

  return await enrichConversation(conversation, userId);
}

/**
 * Reset unread count for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User's profile ID
 * @returns {Promise<Object>} Updated conversation with new unread count
 * @throws {Error} If conversation not found
 */
async function resetUnreadCount(conversationId, userId) {
  const conversation = await conversationRepository.resetUnreadCount(conversationId, userId);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return {
    unreadCount: conversation.unreadCounts.get(userId) || 0
  };
}

/**
 * Archive (soft delete) a conversation for a user
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User's profile ID
 * @returns {Promise<void>}
 * @throws {Error} If conversation not found or user is not a participant
 */
async function archiveConversation(conversationId, userId) {
  const conversation = await conversationRepository.getConversationById(conversationId);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Check if user is a participant
  if (!conversation.participants.includes(userId)) {
    throw new Error('Access denied');
  }

  // Archive the conversation for this user
  await conversationRepository.setArchiveStatus(conversationId, userId, true);
}

module.exports = {
  listUserConversations,
  getConversationById,
  resetUnreadCount,
  archiveConversation,
  enrichConversation
};

