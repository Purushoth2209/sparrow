import apiClient from './index';

export const authApi = {
  login: async (identifier, password) => {
    const { data } = await apiClient.post('/api/auth/login', {
      identifier,
      password,
    });
    return data;
  },

  register: async (email, password, username, fullName) => {
    const { data } = await apiClient.post('/api/auth/register', {
      email: email.toLowerCase().trim(),
      password,
      username,
      fullName,
    });
    return data;
  },

  logout: async () => {
    await apiClient.post('/api/auth/logout');
  },

  checkUsername: async (username) => {
    const { data } = await apiClient.get('/api/auth/check-username', {
      params: { username },
    });
    return data;
  },

  setUsername: async (username) => {
    const { data } = await apiClient.post('/api/auth/set-username', {
      username: username.trim(),
    });
    return data;
  },
};

