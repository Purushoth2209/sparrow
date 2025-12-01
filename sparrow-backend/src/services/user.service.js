const userRepository = require('../repositories/user.repository');

/**
 * User Service
 * Contains business logic for user operations
 */

async function getCurrentUser(profileId) {
  const user = await userRepository.findUserByProfileId(profileId);
  if (!user) {
    throw new Error('User not found');
  }

  return {
    profileId: user.profileId,
    username: user.username,
    email: user.email || null,
    phoneNumber: user.phoneNumber || null,
    fullName: user.fullName || '',
    profileImage: user.profileImage || ''
  };
}

module.exports = {
  getCurrentUser
};

