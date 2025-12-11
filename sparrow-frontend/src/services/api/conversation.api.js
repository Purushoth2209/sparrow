import apiClient from './index';

/**
 * Conversation API Service
 * Handles all conversation-related API calls
 */

export const conversationApi = {
  /**
   * Get all conversations for the authenticated user
   * @param {Object} options - Query options (limit, offset, includeArchived)
   * @returns {Promise<Object>} Response with conversations array
   */
  getConversations: async (options = {}) => {
    const { limit = 50, offset = 0, includeArchived = false } = options;
    const { data } = await apiClient.get('/api/conversations', {
      params: { limit, offset, includeArchived }
    });
    return data;
  },

  /**
   * Get a specific conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Response with conversation object
   */
  getConversation: async (conversationId) => {
    const { data } = await apiClient.get(`/api/conversations/${conversationId}`);
    return data;
  },

  /**
   * Reset unread count for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Response with updated unread count
   */
  resetUnread: async (conversationId) => {
    const { data } = await apiClient.post('/api/conversations/reset-unread', {
      conversationId
    });
    return data;
  },

  /**
   * Delete (archive) a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Response with success status
   */
  deleteConversation: async (conversationId) => {
    const { data } = await apiClient.delete(`/api/conversations/${conversationId}`);
    return data;
  }
};

