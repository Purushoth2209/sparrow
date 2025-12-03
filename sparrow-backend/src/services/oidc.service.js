const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getGoogleClient } = require('../config/oidcClients');
const { extractUserInfo } = require('../utils/tokenVerifier');
const { generators } = require('openid-client');
const authRepository = require('../repositories/auth.repository');
const userRepository = require('../repositories/user.repository');
const authService = require('./auth.service');

/**
 * OIDC Service
 * Handles Google OIDC authentication logic
 */

/**
 * Initiate Google OIDC login
 * @param {Object} req - Express request object
 * @returns {Promise<string>} Authorization URL
 */
async function initiateGoogleLogin(req) {
  const client = await getGoogleClient();
  
  const state = generators.state();
  const nonce = generators.nonce();
  
  req.session.oidcState = state;
  req.session.oidcNonce = nonce;
  
  const authorizationUrl = client.authorizationUrl({
    scope: 'openid email profile',
    state,
    nonce,
  });
  
  return authorizationUrl;
}

/**
 * Handle Google OIDC callback
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} User data
 */
async function handleGoogleCallback(req) {
  const client = await getGoogleClient();
  const params = client.callbackParams(req);
  
  if (!req.session.oidcState || params.state !== req.session.oidcState) {
    throw new Error('Invalid state parameter');
  }
  
  const tokenSet = await client.callback(
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback',
    params,
    { 
      state: req.session.oidcState,
      nonce: req.session.oidcNonce 
    }
  );
  
  const claims = tokenSet.claims();
  const userInfo = extractUserInfo(claims);
  
  let user = await authRepository.findUserByEmailOrProfileId(
    userInfo.email,
    `google-${userInfo.providerId}`
  );
  
  if (!user) {
    user = await userRepository.createUser({
      fullName: userInfo.fullName,
      email: userInfo.email,
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      profileId: `google-${userInfo.providerId}`,
      username: `temp_${userInfo.providerId}`,
      profileImage: userInfo.picture,
      isOnline: false,
      socketId: null,
      passwordChangedAt: new Date(),
      needsUsernameSetup: true,
    });
  } else {
    user.fullName = userInfo.fullName || user.fullName;
    user.profileImage = userInfo.picture || user.profileImage;
    user.email = userInfo.email || user.email;
    await user.save();
  }
  
  return {
    profileId: user.profileId,
    username: user.username,
    email: user.email,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
    profileImage: user.profileImage,
    needsUsernameSetup: user.needsUsernameSetup
  };
}

/**
 * Clean up OIDC state and nonce from session
 * @param {Object} req - Express request object
 */
function cleanupOidcState(req) {
  delete req.session.oidcState;
  delete req.session.oidcNonce;
}

module.exports = {
  initiateGoogleLogin,
  handleGoogleCallback,
  cleanupOidcState
};

