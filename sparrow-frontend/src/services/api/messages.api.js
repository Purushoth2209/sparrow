import apiClient from './index';

export const messagesApi = {
  sendMessage: async (receiverId, content, tempId = null) => {
    const payload = {
      receiverId,
      content,
    };
    
    // Include tempId if provided (for queue processing)
    if (tempId) {
      payload.tempId = tempId;
    }
    
    const { data } = await apiClient.post('/api/messages/send', payload);
    return data;
  },

  getMessages: async (conversationId, limit = 50, offset = 0) => {
    const { data } = await apiClient.get('/api/messages', {
      params: { conversationId, limit, offset },
    });
    return data;
  },

  markAsRead: async (messageIds) => {
    const { data } = await apiClient.post('/api/messages/read', {
      messageIds,
    });
    return data;
  },

  /**
   * Sync messages since a timestamp (for offline/mobile sync)
   * @param {Date|string} since - Timestamp to sync from
   * @returns {Promise<Object>} Response with messages, conversations, and syncTimestamp
   */
  sync: async (since = null) => {
    const params = since ? { since: since instanceof Date ? since.toISOString() : since } : {};
    const { data } = await apiClient.get('/api/messages/sync', { params });
    return data;
  },
};

