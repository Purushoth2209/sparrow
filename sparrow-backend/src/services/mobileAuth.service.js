const authService = require('./auth.service');
const jwtService = require('./jwt.service');
const authRepository = require('../repositories/auth.repository');
const userRepository = require('../repositories/user.repository');
const { getGoogleClient } = require('../config/oidcClients');
const { extractUserInfo } = require('../utils/tokenVerifier');
const { generators } = require('openid-client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Mobile Auth Service
 * Contains business logic for mobile JWT-based authentication
 */

// In-memory cache for OIDC state/nonce (TTL: 10 minutes)
// For production with multiple instances, use Redis instead
const oidcStateCache = new Map();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oidcStateCache.entries()) {
    if (data.expiresAt < now) {
      oidcStateCache.delete(state);
    }
  }
}, 5 * 60 * 1000);

/**
 * Mobile login with username/email/phone + password
 * @param {string} identifier - Username, email, or phone number
 * @param {string} email - Email (optional, if provided separately)
 * @param {string} phoneNumber - Phone number (optional, for existing users only)
 * @param {string} password - User password
 * @param {string} country - Country code for phone validation
 * @returns {Promise<Object>} User data with access and refresh tokens
 */
async function mobileLogin(identifier, email, phoneNumber, password, country) {
  // Validate credentials presence
  const hasValidIdentifier = identifier && typeof identifier === 'string' && identifier.trim().length > 0;
  const hasValidEmail = email && typeof email === 'string' && email.trim().length > 0;
  const hasValidPhone = phoneNumber && typeof phoneNumber === 'string' && phoneNumber.trim().length > 0;
  const hasValidPassword = password && typeof password === 'string' && password.trim().length > 0;

  if (!hasValidPassword || (!hasValidIdentifier && !hasValidEmail && !hasValidPhone)) {
    throw new Error('Invalid credentials');
  }

  // Normalize inputs
  const idRaw = typeof identifier === 'string' ? identifier.trim() : undefined;
  const emailRaw = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
  const phoneRaw = typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined;

  // Reuse existing login logic from auth.service
  const user = await authService.loginUser(idRaw || emailRaw || phoneRaw, emailRaw, phoneRaw, password, country);
  
  // Generate JWT tokens
  const accessToken = jwtService.generateAccessToken({
    userId: user.profileId,
    profileId: user.profileId,
    email: user.email,
    username: user.username
  });
  
  const refreshToken = jwtService.generateRefreshToken({
    userId: user.profileId,
    profileId: user.profileId,
    email: user.email,
    username: user.username
  });
  
  // Store refresh token in database
  await authRepository.storeRefreshToken(user.profileId, refreshToken);
  
  return {
    user: {
      profileId: user.profileId,
      username: user.username,
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      fullName: user.fullName || '',
      profileImage: user.profileImage || ''
    },
    accessToken,
    refreshToken,
    passwordWarning: user.passwordWarning
  };
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New access token and optionally new refresh token
 */
async function refreshAccessToken(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new Error('Refresh token is required');
  }

  // Verify refresh token
  const decoded = jwtService.verifyRefreshToken(refreshToken);
  
  // Check if token exists in database
  const hasToken = await authRepository.hasRefreshToken(decoded.profileId, refreshToken);
  if (!hasToken) {
    throw new Error('Invalid refresh token');
  }
  
  // Get user to ensure they still exist
  const user = await userRepository.findUserByProfileId(decoded.profileId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Generate new access token
  const accessToken = jwtService.generateAccessToken({
    userId: user.profileId,
    profileId: user.profileId,
    email: user.email,
    username: user.username
  });
  
  return {
    accessToken
  };
}

/**
 * Logout - invalidate refresh token
 * @param {string} refreshToken - Refresh token to invalidate (required)
 * @returns {Promise<void>}
 */
async function mobileLogout(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new Error('Refresh token is required');
  }
  
  // Verify refresh token to get profileId
  const decoded = jwtService.verifyRefreshToken(refreshToken);
  
  // Remove the specific refresh token
  await authRepository.removeRefreshToken(decoded.profileId, refreshToken);
}

/**
 * Get Google OIDC authorization URL for mobile
 * @returns {Promise<Object>} Authorization URL with state and nonce
 */
async function getGoogleAuthUrl() {
  const client = await getGoogleClient();
  
  const state = generators.state();
  const nonce = generators.nonce();
  
  const authorizationUrl = client.authorizationUrl({
    scope: 'openid email profile',
    state,
    nonce,
  });
  
  // Store state/nonce in cache for validation (10 minute TTL)
  oidcStateCache.set(state, {
    nonce,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });
  
  // Return URL and state for mobile to use
  return {
    authorizationUrl,
    state
  };
}

/**
 * Handle Google OIDC callback for mobile
 * @param {string} code - Authorization code from Google
 * @param {string} state - State parameter (should match the one sent)
 * @returns {Promise<Object>} User data with access and refresh tokens
 */
async function handleGoogleCallback(code, state) {
  if (!code || !state) {
    throw new Error('Missing required parameters (code, state)');
  }

  const client = await getGoogleClient();
  
  // Retrieve nonce from cache using state
  const cachedData = oidcStateCache.get(state);
  if (!cachedData) {
    throw new Error('Invalid or expired state parameter');
  }
  
  const nonce = cachedData.nonce;
  
  // Remove state from cache after use (one-time use)
  oidcStateCache.delete(state);
  
  // Exchange authorization code for tokens
  const tokenSet = await client.callback(
    process.env.GOOGLE_MOBILE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/mobile/google/callback',
    { code, state },
    { state, nonce }
  );
  
  // Extract user info from ID token
  const claims = tokenSet.claims();
  const userInfo = extractUserInfo(claims);
  
  // Find or create user
  let user = await authRepository.findUserByEmailOrProfileId(
    userInfo.email,
    `google-${userInfo.providerId}`
  );
  
  if (!user) {
    // Generate unique username for Google user
    const username = await authService.generateUniqueUsernameForGoogle(userInfo);
    
    user = await userRepository.createUser({
      fullName: userInfo.fullName,
      email: userInfo.email,
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      profileId: `google-${userInfo.providerId}`,
      username: username,
      profileImage: userInfo.picture,
      isOnline: false,
      socketId: null,
      passwordChangedAt: new Date(),
      needsUsernameSetup: false,
    });
  } else {
    // Update user info
    user.fullName = userInfo.fullName || user.fullName;
    user.profileImage = userInfo.picture || user.profileImage;
    user.email = userInfo.email || user.email;
    await user.save();
  }
  
  // Generate JWT tokens
  const accessToken = jwtService.generateAccessToken({
    userId: user.profileId,
    profileId: user.profileId,
    email: user.email,
    username: user.username
  });
  
  const refreshToken = jwtService.generateRefreshToken({
    userId: user.profileId,
    profileId: user.profileId,
    email: user.email,
    username: user.username
  });
  
  // Store refresh token
  await authRepository.storeRefreshToken(user.profileId, refreshToken);
  
  return {
    user: {
      profileId: user.profileId,
      username: user.username,
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      fullName: user.fullName || '',
      profileImage: user.profileImage || ''
    },
    accessToken,
    refreshToken,
    needsUsernameSetup: user.needsUsernameSetup || false
  };
}

module.exports = {
  mobileLogin,
  refreshAccessToken,
  mobileLogout,
  getGoogleAuthUrl,
  handleGoogleCallback
};

