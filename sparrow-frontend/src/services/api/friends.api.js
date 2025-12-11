import apiClient from './index';

export const friendsApi = {
  getFriends: async (searchQuery = '') => {
    const { data } = await apiClient.get('/api/search-friends', {
      params: searchQuery ? { username: searchQuery } : {},
    });
    return data;
  },

  getFriendRequests: async () => {
    const { data } = await apiClient.get('/api/friend-requests');
    return data;
  },

  sendFriendRequest: async (toUserId) => {
    const { data } = await apiClient.post('/api/send-request', {
      toUserId,
    });
    return data;
  },

  acceptFriendRequest: async (fromUserId) => {
    const { data } = await apiClient.post('/api/accept-request', {
      fromUserId,
    });
    return data;
  },

  rejectFriendRequest: async (fromUserId) => {
    const { data } = await apiClient.post('/api/reject-request', {
      fromUserId,
    });
    return data;
  },

  removeFriend: async (friendId) => {
    const { data } = await apiClient.post('/api/remove-friend', {
      friendId,
    });
    return data;
  },
};

