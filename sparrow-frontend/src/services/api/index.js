import axios from 'axios';

// Create shared axios instance
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000',
  withCredentials: true, // Important for session-based auth
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - Add auth token if present (for mobile later)
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage (for future mobile JWT support)
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add cache-busting headers
    config.headers['Cache-Control'] = 'no-cache';
    config.headers['Pragma'] = 'no-cache';
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - Session expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear auth data
      localStorage.removeItem('profileId');
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
      localStorage.removeItem('email');
      localStorage.removeItem('fullName');
      localStorage.removeItem('profileImage');

      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }

      return Promise.reject(error);
    }

    // Handle network errors
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }

    // Handle other errors
    if (error.response?.status >= 500) {
      error.message = 'Server error. Please try again later.';
    }

    return Promise.reject(error);
  }
);

export default apiClient;

