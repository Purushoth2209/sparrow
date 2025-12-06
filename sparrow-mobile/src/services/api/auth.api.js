import { API_URLS } from '../../config';

/**
 * Authentication API Service
 * Handles all authentication-related API calls
 */

/**
 * Mobile Login
 * @param {string} identifier - Username, email, or phone
 * @param {string} email - Email address (optional if identifier is used)
 * @param {string} phoneNumber - Phone number (optional if identifier is used)
 * @param {string} password - User password
 * @param {string} country - Country code (optional, for phone validation)
 * @returns {Promise} Login response with accessToken and refreshToken
 */
export const mobileLogin = async (identifier, email, phoneNumber, password, country) => {
  try {
    const body = { password };
    
    // Use identifier if provided, otherwise use email or phoneNumber
    if (identifier) {
      body.identifier = identifier;
    } else if (email) {
      body.email = email;
    } else if (phoneNumber) {
      body.phoneNumber = phoneNumber;
      if (country) body.country = country;
    } else {
      throw new Error('Identifier, email, or phoneNumber is required');
    }

    const response = await fetch(`${API_URLS.MOBILE_AUTH}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Mobile Register
 * Note: Using web register endpoint as mobile-specific register may not exist
 * @param {Object} userData - User registration data
 * @param {string} userData.username - Username (required)
 * @param {string} userData.password - Password (required)
 * @param {string} userData.email - Email address (required)
 * @param {string} userData.fullName - Full name (optional)
 * @returns {Promise} Registration response
 */
export const mobileRegister = async (userData) => {
  try {
    const { username, password, email, fullName } = userData;

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    if (!email) {
      throw new Error('Email is required');
    }

    const body = {
      username,
      password,
      email,
      ...(fullName && { fullName }),
    };

    const response = await fetch(`${API_URLS.AUTH}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Refresh Access Token
 * @param {string} refreshToken - Refresh token from login
 * @returns {Promise} New access token and refresh token
 */
export const refreshToken = async (refreshToken) => {
  try {
    const response = await fetch(`${API_URLS.MOBILE_AUTH}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Token refresh failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Mobile Logout
 * @param {string} refreshToken - Refresh token to invalidate
 * @returns {Promise} Logout response
 */
export const mobileLogout = async (refreshToken) => {
  try {
    const response = await fetch(`${API_URLS.MOBILE_AUTH}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Logout failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get Google OAuth URL
 * @returns {Promise} Google OAuth URL and state
 */
export const getGoogleAuthUrl = async () => {
  try {
    const response = await fetch(`${API_URLS.MOBILE_AUTH}/google-url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get Google auth URL');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export default {
  mobileLogin,
  mobileRegister,
  refreshToken,
  mobileLogout,
  getGoogleAuthUrl,
};

