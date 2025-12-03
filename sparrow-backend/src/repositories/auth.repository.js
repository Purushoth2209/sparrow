const User = require('../models/User');

/**
 * Auth Repository
 * Contains all database queries related to authentication
 */

const findUserForLogin = async (query) => {
  return await User.findOne(query);
};

const updateLoginAttempts = async (profileId, loginAttempts, lockUntil = null) => {
  return await User.findOneAndUpdate(
    { profileId },
    { 
      loginAttempts,
      lockUntil,
      lastLoginAttempt: new Date()
    },
    { new: true }
  );
};

const resetLoginAttempts = async (profileId) => {
  return await User.findOneAndUpdate(
    { profileId },
    { 
      loginAttempts: 0,
      lockUntil: null,
      lastLoginAttempt: new Date()
    },
    { new: true }
  );
};

const findUserByEmailOrProfileId = async (email, profileId) => {
  return await User.findOne({
    $or: [
      { email },
      { profileId }
    ]
  });
};

/**
 * Store refresh token for a user
 * @param {string} profileId - User profile ID
 * @param {string} refreshToken - Refresh token to store
 * @returns {Promise<void>}
 */
const storeRefreshToken = async (profileId, refreshToken) => {
  await User.findOneAndUpdate(
    { profileId },
    { $addToSet: { refreshTokens: refreshToken } },
    { upsert: false }
  );
};

/**
 * Check if refresh token exists for user
 * @param {string} profileId - User profile ID
 * @param {string} refreshToken - Refresh token to check
 * @returns {Promise<boolean>} True if token exists
 */
const hasRefreshToken = async (profileId, refreshToken) => {
  const user = await User.findOne({
    profileId,
    refreshTokens: refreshToken
  });
  return !!user;
};

/**
 * Remove refresh token from user
 * @param {string} profileId - User profile ID
 * @param {string} refreshToken - Refresh token to remove
 * @returns {Promise<void>}
 */
const removeRefreshToken = async (profileId, refreshToken) => {
  await User.findOneAndUpdate(
    { profileId },
    { $pull: { refreshTokens: refreshToken } }
  );
};

/**
 * Remove all refresh tokens for a user (logout all devices)
 * @param {string} profileId - User profile ID
 * @returns {Promise<void>}
 */
const removeAllRefreshTokens = async (profileId) => {
  await User.findOneAndUpdate(
    { profileId },
    { $set: { refreshTokens: [] } }
  );
};

module.exports = {
  findUserForLogin,
  updateLoginAttempts,
  resetLoginAttempts,
  findUserByEmailOrProfileId,
  storeRefreshToken,
  hasRefreshToken,
  removeRefreshToken,
  removeAllRefreshTokens
};

