const User = require('../models/User');

/**
 * User Repository
 * Contains all database queries related to user operations
 * Follows repository pattern for separation of concerns
 */

/**
 * Find user by profileId
 * @param {string} profileId - User profile ID
 * @returns {Promise<Object|null>} User document or null
 */
const findByProfileId = async (profileId) => {
  return await User.findOne({ profileId });
};

/**
 * Find user by username
 * @param {string} username - Username to search for
 * @returns {Promise<Object|null>} User document or null
 */
const findByUsername = async (username) => {
  return await User.findOne({ username: username.trim() });
};

/**
 * Search users by username or fullName
 * Excludes blocked users and the current user
 * @param {string} query - Search query string
 * @param {string} currentUserId - Current user's profileId to exclude
 * @param {Array<string>} blockedUserIds - Array of blocked user profileIds
 * @returns {Promise<Array>} Array of user documents
 */
const searchUsers = async (query, currentUserId, blockedUserIds = []) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim();
  const excludeIds = [currentUserId, ...blockedUserIds];

  return await User.find({
    $and: [
      {
        $or: [
          { username: { $regex: searchTerm, $options: 'i' } },
          { fullName: { $regex: searchTerm, $options: 'i' } }
        ]
      },
      { profileId: { $nin: excludeIds } }
    ]
  })
    .select('profileId username fullName about profileImage blockedUsers')
    .limit(50);
};

/**
 * Update user fields
 * @param {string} profileId - User profile ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object|null>} Updated user document or null
 */
const updateUser = async (profileId, updateData) => {
  return await User.findOneAndUpdate(
    { profileId },
    { $set: updateData },
    { new: true, runValidators: true }
  );
};

/**
 * Set profile image URL
 * @param {string} profileId - User profile ID
 * @param {string} imageUrl - Profile image URL
 * @returns {Promise<Object|null>} Updated user document or null
 */
const setProfileImage = async (profileId, imageUrl) => {
  return await User.findOneAndUpdate(
    { profileId },
    { $set: { profileImage: imageUrl } },
    { new: true }
  );
};

/**
 * Delete profile image (set to empty string)
 * @param {string} profileId - User profile ID
 * @returns {Promise<Object|null>} Updated user document or null
 */
const deleteProfileImage = async (profileId) => {
  return await User.findOneAndUpdate(
    { profileId },
    { $set: { profileImage: '' } },
    { new: true }
  );
};

/**
 * Delete user account
 * Also removes user from other users' friend lists
 * @param {string} profileId - User profile ID to delete
 * @returns {Promise<Object|null>} Deleted user document or null
 */
const deleteUser = async (profileId) => {
  // Remove user from all friends' friend lists
  await User.updateMany(
    { friends: profileId },
    { $pull: { friends: profileId } }
  );

  // Remove user from all friend requests
  await User.updateMany(
    { 'friendRequests.fromUserId': profileId },
    { $pull: { friendRequests: { fromUserId: profileId } } }
  );

  // Remove user from all blockedUsers arrays
  await User.updateMany(
    { 'blockedUsers.profileId': profileId },
    { $pull: { blockedUsers: { profileId: profileId } } }
  );

  // Delete the user
  return await User.findOneAndDelete({ profileId });
};

/**
 * Block a user
 * Adds target user to current user's blockedUsers array
 * @param {string} currentUserId - Current user's profileId
 * @param {string} targetId - Target user's profileId to block
 * @returns {Promise<Object|null>} Updated user document or null
 */
const blockUser = async (currentUserId, targetId) => {
  const user = await User.findOne({ profileId: currentUserId });
  if (!user) {
    return null;
  }

  // Check if already blocked
  const alreadyBlocked = user.blockedUsers.some(
    blocked => blocked.profileId === targetId
  );

  if (!alreadyBlocked) {
    user.blockedUsers.push({
      profileId: targetId,
      blockedAt: new Date()
    });
    await user.save();
  }

  // Remove from friends list if they are friends
  if (user.friends.includes(targetId)) {
    user.friends = user.friends.filter(id => id !== targetId);
    await user.save();
  }

  // Also remove current user from target's friends list
  const targetUser = await User.findOne({ profileId: targetId });
  if (targetUser && targetUser.friends.includes(currentUserId)) {
    targetUser.friends = targetUser.friends.filter(id => id !== currentUserId);
    await targetUser.save();
  }

  // Remove friend requests between them
  await User.updateMany(
    { profileId: { $in: [currentUserId, targetId] } },
    { $pull: { friendRequests: { fromUserId: { $in: [currentUserId, targetId] } } } }
  );

  return user;
};

/**
 * Unblock a user
 * Removes target user from current user's blockedUsers array
 * @param {string} currentUserId - Current user's profileId
 * @param {string} targetId - Target user's profileId to unblock
 * @returns {Promise<Object|null>} Updated user document or null
 */
const unblockUser = async (currentUserId, targetId) => {
  return await User.findOneAndUpdate(
    { profileId: currentUserId },
    { $pull: { blockedUsers: { profileId: targetId } } },
    { new: true }
  );
};

/**
 * Get list of blocked users
 * @param {string} profileId - User profile ID
 * @returns {Promise<Array>} Array of blocked user objects with profileId and blockedAt
 */
const getBlockedUsers = async (profileId) => {
  const user = await User.findOne({ profileId }).select('blockedUsers');
  return user ? user.blockedUsers : [];
};

/**
 * Find multiple users by profileIds
 * @param {Array<string>} profileIds - Array of profile IDs
 * @returns {Promise<Array>} Array of user documents
 */
const findUsersByProfileIds = async (profileIds) => {
  if (!profileIds || profileIds.length === 0) {
    return [];
  }
  return await User.find({ profileId: { $in: profileIds } });
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user document
 */
const createUser = async (userData) => {
  const user = new User(userData);
  return await user.save();
};

/**
 * Find user by email or phone or username
 * @param {string} email - Email address
 * @param {string} phoneNumber - Phone number
 * @param {string} username - Username
 * @returns {Promise<Object|null>} User document or null
 */
const findUserByEmailOrPhoneOrUsername = async (email, phoneNumber, username) => {
  const query = {
    $or: []
  };

  if (email) {
    query.$or.push({ email: email.toLowerCase().trim() });
  }
  if (phoneNumber) {
    query.$or.push({ phoneNumber });
  }
  if (username) {
    query.$or.push({ username: username.trim() });
  }

  if (query.$or.length === 0) {
    return null;
  }

  return await User.findOne(query);
};

// Legacy method name for backward compatibility
const findUserByProfileId = findByProfileId;

module.exports = {
  findByProfileId,
  findUserByProfileId, // Legacy alias
  findByUsername,
  searchUsers,
  updateUser,
  setProfileImage,
  deleteProfileImage,
  deleteUser,
  blockUser,
  unblockUser,
  getBlockedUsers,
  findUsersByProfileIds,
  createUser,
  findUserByEmailOrPhoneOrUsername
};

