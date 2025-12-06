const userRepository = require('../repositories/user.repository');
const friendRepository = require('../repositories/friend.repository');
const s3Service = require('../s3/s3.service');

/**
 * User Service
 * Contains business logic for user operations
 * Handles validation, field visibility, and business rules
 */

/**
 * Get current user's full profile
 * @param {string} profileId - Current user's profileId
 * @returns {Promise<Object>} User profile with all fields
 */
async function getCurrentUser(profileId) {
  const user = await userRepository.findByProfileId(profileId);
  if (!user) {
    throw new Error('User not found');
  }

  return {
    profileId: user.profileId,
    username: user.username,
    fullName: user.fullName || '',
    about: user.about || '',
    email: user.email || null,
    phoneNumber: user.phoneNumber || null,
    profileImage: user.profileImage || ''
  };
}

/**
 * Get limited profile for another user
 * Excludes sensitive fields like email and phoneNumber
 * @param {string} profileId - Target user's profileId
 * @param {string} currentUserId - Current user's profileId
 * @returns {Promise<Object>} Limited user profile
 */
async function getUserProfile(profileId, currentUserId) {
  // Check if current user is blocked by target user
  const targetUser = await userRepository.findByProfileId(profileId);
  if (!targetUser) {
    throw new Error('User not found');
  }

  // Check if target user has blocked current user
  const isBlockedByTarget = targetUser.blockedUsers.some(
    blocked => blocked.profileId === currentUserId
  );
  if (isBlockedByTarget) {
    throw new Error('User not found'); // Don't reveal that user exists but blocked you
  }

  // Check if current user has blocked target user
  const currentUser = await userRepository.findByProfileId(currentUserId);
  if (!currentUser) {
    throw new Error('Current user not found');
  }

  const isBlocked = currentUser.blockedUsers.some(
    blocked => blocked.profileId === profileId
  );
  if (isBlocked) {
    throw new Error('User not found'); // Don't reveal that user exists but is blocked
  }

  return {
    profileId: targetUser.profileId,
    username: targetUser.username,
    fullName: targetUser.fullName || '',
    about: targetUser.about || '',
    profileImage: targetUser.profileImage || ''
  };
}

/**
 * Search users globally by username or fullName
 * Excludes blocked users and current user
 * @param {string} query - Search query
 * @param {string} currentUserId - Current user's profileId
 * @returns {Promise<Array>} Array of limited user profiles
 */
async function searchUsers(query, currentUserId) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  // Get current user's blocked users
  const currentUser = await userRepository.findByProfileId(currentUserId);
  if (!currentUser) {
    throw new Error('Current user not found');
  }

  const blockedUserIds = currentUser.blockedUsers.map(b => b.profileId);

  // Also get users who have blocked current user
  const usersWhoBlockedMe = await userRepository.findUsersByProfileIds(blockedUserIds);
  const allBlockedIds = [
    ...blockedUserIds,
    ...usersWhoBlockedMe
      .filter(u => u.blockedUsers.some(b => b.profileId === currentUserId))
      .map(u => u.profileId)
  ];

  const users = await userRepository.searchUsers(query, currentUserId, allBlockedIds);

  // Filter out users who have blocked current user
  const filteredUsers = users.filter(user => {
    const userBlockedMe = user.blockedUsers?.some(
      blocked => blocked.profileId === currentUserId
    );
    return !userBlockedMe;
  });

  return filteredUsers.map(user => ({
    profileId: user.profileId,
    username: user.username,
    fullName: user.fullName || '',
    about: user.about || '',
    profileImage: user.profileImage || ''
  }));
}

/**
 * Update user profile
 * @param {string} profileId - User's profileId
 * @param {Object} updateData - Fields to update (username, fullName, about)
 * @returns {Promise<Object>} Updated user profile
 */
async function updateUser(profileId, updateData) {
  const { username, fullName, about } = updateData;

  const updateFields = {};

  // Validate and add username if provided
  if (username !== undefined) {
    if (typeof username !== 'string' || username.trim().length === 0) {
      throw new Error('Username cannot be empty');
    }
    if (username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }
    if (username.trim().length > 30) {
      throw new Error('Username must be less than 30 characters');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      throw new Error('Username can only contain letters, numbers, and underscores');
    }

    // Check if username is already taken
    const existingUser = await userRepository.findByUsername(username.trim());
    if (existingUser && existingUser.profileId !== profileId) {
      throw new Error('Username already taken');
    }

    updateFields.username = username.trim();
  }

  // Validate and add fullName if provided
  if (fullName !== undefined) {
    if (typeof fullName !== 'string') {
      throw new Error('Full name must be a string');
    }
    if (fullName.trim().length > 100) {
      throw new Error('Full name must be less than 100 characters');
    }
    updateFields.fullName = fullName.trim();
  }

  // Validate and add about if provided
  if (about !== undefined) {
    if (typeof about !== 'string') {
      throw new Error('About must be a string');
    }
    if (about.trim().length > 500) {
      throw new Error('About must be less than 500 characters');
    }
    updateFields.about = about.trim();
  }

  if (Object.keys(updateFields).length === 0) {
    throw new Error('No valid fields to update');
  }

  const updatedUser = await userRepository.updateUser(profileId, updateFields);
  if (!updatedUser) {
    throw new Error('User not found');
  }

  return {
    profileId: updatedUser.profileId,
    username: updatedUser.username,
    fullName: updatedUser.fullName || '',
    about: updatedUser.about || '',
    profileImage: updatedUser.profileImage || ''
  };
}

/**
 * Set profile picture URL
 * @param {string} profileId - User's profileId
 * @param {string} imageUrl - Profile image URL
 * @returns {Promise<Object>} Updated user profile
 */
async function setProfileImage(profileId, imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Valid image URL is required');
  }

  if (imageUrl.trim().length === 0) {
    throw new Error('Image URL cannot be empty');
  }

  // Basic URL validation
  try {
    new URL(imageUrl);
  } catch (error) {
    throw new Error('Invalid image URL format');
  }

  const updatedUser = await userRepository.setProfileImage(profileId, imageUrl.trim());
  if (!updatedUser) {
    throw new Error('User not found');
  }

  return {
    profileId: updatedUser.profileId,
    profileImage: updatedUser.profileImage || ''
  };
}

/**
 * Delete profile picture
 * @param {string} profileId - User's profileId
 * @returns {Promise<Object>} Updated user profile
 */
async function deleteProfileImage(profileId) {
  const user = await userRepository.findByProfileId(profileId);
  if (!user) {
    throw new Error('User not found');
  }

  // Delete from S3 if exists
  if (user.profileImage) {
    await s3Service.handleDelete(user.profileImage);
  }

  const updatedUser = await userRepository.deleteProfileImage(profileId);
  if (!updatedUser) {
    throw new Error('User not found');
  }

  return {
    profileId: updatedUser.profileId,
    profileImage: ''
  };
}

/**
 * Update profile picture with file upload to S3
 * @param {string} profileId - User's profileId
 * @param {Object} imageFile - Multer file object
 * @returns {Promise<Object>} Updated user profile with new S3 URL
 */
async function updateProfilePicture(profileId, imageFile) {
  if (!imageFile) {
    throw new Error('Image file is required');
  }

  // Get current user to check existing profile image
  const user = await userRepository.findByProfileId(profileId);
  if (!user) {
    throw new Error('User not found');
  }

  // Delete old image from S3 if exists
  if (user.profileImage) {
    await s3Service.handleDelete(user.profileImage);
  }

  // Upload new image to S3
  const newImageUrl = await s3Service.handleUpload(imageFile, profileId);

  // Update user's profileImage in MongoDB
  const updatedUser = await userRepository.setProfileImage(profileId, newImageUrl);
  if (!updatedUser) {
    throw new Error('Failed to update user profile');
  }

  return {
    profileId: updatedUser.profileId,
    profileImage: updatedUser.profileImage || ''
  };
}

/**
 * Delete user account
 * Removes user and cascades to friends, friend requests, etc.
 * @param {string} profileId - User's profileId
 * @returns {Promise<Object>} Success message
 */
async function deleteUser(profileId) {
  const user = await userRepository.findByProfileId(profileId);
  if (!user) {
    throw new Error('User not found');
  }

  await userRepository.deleteUser(profileId);

  return {
    message: 'User account deleted successfully'
  };
}

/**
 * Block a user
 * @param {string} currentUserId - Current user's profileId
 * @param {string} targetId - Target user's profileId to block
 * @returns {Promise<Object>} Success message
 */
async function blockUser(currentUserId, targetId) {
  if (currentUserId === targetId) {
    throw new Error('Cannot block yourself');
  }

  const targetUser = await userRepository.findByProfileId(targetId);
  if (!targetUser) {
    throw new Error('User not found');
  }

  const currentUser = await userRepository.findByProfileId(currentUserId);
  if (!currentUser) {
    throw new Error('Current user not found');
  }

  // Check if already blocked
  const alreadyBlocked = currentUser.blockedUsers.some(
    blocked => blocked.profileId === targetId
  );
  if (alreadyBlocked) {
    throw new Error('User is already blocked');
  }

  await userRepository.blockUser(currentUserId, targetId);

  return {
    message: 'User blocked successfully',
    blockedUserId: targetId
  };
}

/**
 * Unblock a user
 * @param {string} currentUserId - Current user's profileId
 * @param {string} targetId - Target user's profileId to unblock
 * @returns {Promise<Object>} Success message
 */
async function unblockUser(currentUserId, targetId) {
  if (currentUserId === targetId) {
    throw new Error('Cannot unblock yourself');
  }

  const currentUser = await userRepository.findByProfileId(currentUserId);
  if (!currentUser) {
    throw new Error('Current user not found');
  }

  // Check if user is blocked
  const isBlocked = currentUser.blockedUsers.some(
    blocked => blocked.profileId === targetId
  );
  if (!isBlocked) {
    throw new Error('User is not blocked');
  }

  const updatedUser = await userRepository.unblockUser(currentUserId, targetId);
  if (!updatedUser) {
    throw new Error('Failed to unblock user');
  }

  return {
    message: 'User unblocked successfully',
    unblockedUserId: targetId
  };
}

/**
 * Get list of blocked users
 * @param {string} profileId - User's profileId
 * @returns {Promise<Array>} Array of blocked user profiles
 */
async function getBlockedUsers(profileId) {
  const user = await userRepository.findByProfileId(profileId);
  if (!user) {
    throw new Error('User not found');
  }

  const blockedUsers = await userRepository.getBlockedUsers(profileId);
  
  if (blockedUsers.length === 0) {
    return [];
  }

  // Get full user details for blocked users
  const blockedProfileIds = blockedUsers.map(b => b.profileId);
  const blockedUserDetails = await userRepository.findUsersByProfileIds(blockedProfileIds);

  return blockedUserDetails.map(user => ({
    profileId: user.profileId,
    username: user.username,
    fullName: user.fullName || '',
    profileImage: user.profileImage || '',
    blockedAt: blockedUsers.find(b => b.profileId === user.profileId)?.blockedAt || null
  }));
}

module.exports = {
  getCurrentUser,
  getUserProfile,
  searchUsers,
  updateUser,
  setProfileImage,
  deleteProfileImage,
  updateProfilePicture,
  deleteUser,
  blockUser,
  unblockUser,
  getBlockedUsers
};
