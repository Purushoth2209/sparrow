const Conversation = require('../models/Conversation');

/**
 * Conversation Repository
 * Handles conversation operations
 */

/**
 * Find or create conversation between two users
 * @param {string} userId1 - First user's profile ID
 * @param {string} userId2 - Second user's profile ID
 * @returns {Promise<Object>} Conversation object
 */
async function findOrCreateConversation(userId1, userId2) {
  return await Conversation.findOrCreate(userId1, userId2);
}

/**
 * Update conversation with new message
 * @param {string} conversationId - Conversation ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated conversation
 */
async function updateConversation(conversationId, updateData) {
  return await Conversation.findOneAndUpdate(
    { conversationId },
    { ...updateData, updatedAt: new Date() },
    { new: true, upsert: false }
  );
}

/**
 * Increment unread count for a user in conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID to increment unread count for
 * @returns {Promise<Object>} Updated conversation
 */
async function incrementUnreadCount(conversationId, userId) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const currentCount = conversation.unreadCounts.get(userId) || 0;
  conversation.unreadCounts.set(userId, currentCount + 1);
  await conversation.save();
  
  return conversation;
}

/**
 * Reset unread count for a user in conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID to reset unread count for
 * @returns {Promise<Object>} Updated conversation
 */
async function resetUnreadCount(conversationId, userId) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  conversation.unreadCounts.set(userId, 0);
  await conversation.save();
  
  return conversation;
}

/**
 * Get conversation by ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Conversation or null
 */
async function getConversationById(conversationId) {
  return await Conversation.findOne({ conversationId });
}

/**
 * Get conversations for a user
 * @param {string} userId - User's profile ID
 * @param {Object} options - Query options (limit, offset, includeArchived)
 * @returns {Promise<Array>} Array of conversations
 */
async function getConversationsForUser(userId, options = {}) {
  const { limit = 50, offset = 0, includeArchived = false } = options;
  
  const query = { participants: userId };
  
  // Filter out archived conversations unless explicitly requested
  if (!includeArchived) {
    // We'll filter in memory since MongoDB doesn't easily support Map field queries
    const allConversations = await Conversation.find(query)
      .sort({ lastMessageTimestamp: -1 });
    
    // Filter out archived conversations
    const filtered = allConversations.filter(conv => {
      const userSettings = conv.userSettings.get(userId);
      return !userSettings || !userSettings.archived;
    });
    
    return filtered.slice(offset, offset + limit);
  }
  
  return await Conversation.find(query)
    .sort({ lastMessageTimestamp: -1 })
    .limit(limit)
    .skip(offset);
}

/**
 * Get conversation between two users
 * @param {string} userId1 - First user's profile ID
 * @param {string} userId2 - Second user's profile ID
 * @returns {Promise<Object|null>} Conversation or null
 */
async function getConversationBetweenUsers(userId1, userId2) {
  const conversationId = Conversation.getConversationId(userId1, userId2);
  return await getConversationById(conversationId);
}

/**
 * Mute or unmute conversation for a user
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {boolean} muted - Mute status
 * @returns {Promise<Object>} Updated conversation
 */
async function setMuteStatus(conversationId, userId, muted) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const userSettings = conversation.userSettings.get(userId) || { muted: false, archived: false };
  userSettings.muted = muted;
  userSettings.mutedAt = muted ? new Date() : null;
  
  conversation.userSettings.set(userId, userSettings);
  await conversation.save();
  
  return conversation;
}

/**
 * Archive or unarchive conversation for a user
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {boolean} archived - Archive status
 * @returns {Promise<Object>} Updated conversation
 */
async function setArchiveStatus(conversationId, userId, archived) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const userSettings = conversation.userSettings.get(userId) || { muted: false, archived: false };
  userSettings.archived = archived;
  userSettings.archivedAt = archived ? new Date() : null;
  
  conversation.userSettings.set(userId, userSettings);
  await conversation.save();
  
  return conversation;
}

/**
 * Get user settings for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User settings { muted, archived, mutedAt, archivedAt }
 */
async function getUserSettings(conversationId, userId) {
  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const userSettings = conversation.userSettings.get(userId) || {
    muted: false,
    archived: false,
    mutedAt: null,
    archivedAt: null
  };
  
  return userSettings;
}

module.exports = {
  findOrCreateConversation,
  updateConversation,
  incrementUnreadCount,
  resetUnreadCount,
  getConversationById,
  getConversationsForUser,
  getConversationBetweenUsers,
  setMuteStatus,
  setArchiveStatus,
  getUserSettings
};


