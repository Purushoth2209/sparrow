import apiClient from './index';

export const userApi = {
  getCurrentUser: async () => {
    const { data } = await apiClient.get('/api/user/me', {
      cache: 'no-store',
    });
    return data;
  },

  searchUsers: async (query) => {
    const { data } = await apiClient.get('/api/user/search', {
      params: { query },
    });
    return data;
  },
};

