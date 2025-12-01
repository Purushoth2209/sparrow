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

module.exports = {
  findUserForLogin,
  updateLoginAttempts,
  resetLoginAttempts,
  findUserByEmailOrProfileId
};

