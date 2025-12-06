import Constants from 'expo-constants';

/**
 * Environment Configuration
 * 
 * Reads from .env files via app.config.js
 * 
 * To switch environments:
 * - Development: Use .env.dev (default)
 * - Production: Set NODE_ENV=production to use .env.prod
 * 
 * Or manually copy .env.dev to .env
 */

// Get environment variables from expo constants (loaded from .env via app.config.js)
const getEnvVars = () => {
  const extra = Constants.expoConfig?.extra || {};
  const env = extra.env || 'dev';
  
  // Get values from expo constants (which reads from .env via app.config.js)
  const apiBaseUrl = extra.apiBaseUrl || 'http://localhost:5000';
  const socketUrl = extra.socketUrl || 'ws://localhost:5000';
  
  return {
    API_BASE_URL: apiBaseUrl,
    SOCKET_URL: socketUrl,
    ENV: env === 'prod' || env === 'production' ? 'production' : 'development',
  };
};

const config = getEnvVars();

// API Endpoints
const API_ENDPOINTS = {
  AUTH: '/api/auth',
  MOBILE_AUTH: '/api/auth/mobile',
  USER: '/api/user',
  FRIENDS: '/api/friends',
  MESSAGES: '/api/messages',
  NOTIFICATIONS: '/api/notifications',
};

// Socket Configuration
const SOCKET_CONFIG = {
  PATH: '/socket.io',
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
};

export default {
  ...config,
  API_ENDPOINTS,
  SOCKET_CONFIG,
  // Full API URLs
  API_URLS: {
    BASE: config.API_BASE_URL,
    AUTH: `${config.API_BASE_URL}${API_ENDPOINTS.AUTH}`,
    MOBILE_AUTH: `${config.API_BASE_URL}${API_ENDPOINTS.MOBILE_AUTH}`,
    USER: `${config.API_BASE_URL}${API_ENDPOINTS.USER}`,
    FRIENDS: `${config.API_BASE_URL}${API_ENDPOINTS.FRIENDS}`,
    MESSAGES: `${config.API_BASE_URL}${API_ENDPOINTS.MESSAGES}`,
    NOTIFICATIONS: `${config.API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS}`,
  },
  // App Configuration
  APP_NAME: 'Sparrow',
  APP_VERSION: '1.0.0',
  // Feature Flags
  FEATURES: {
    GOOGLE_AUTH: true,
    PHONE_AUTH: true,
  },
};

