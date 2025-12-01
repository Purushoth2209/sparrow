const User = require('../models/User');

/**
 * User Repository
 * Contains all database queries related to users
 */

const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};

const findUserByPhoneNumber = async (phoneNumber) => {
  return await User.findOne({ phoneNumber });
};

const findUserByUsername = async (username) => {
  return await User.findOne({ username });
};

const findUserByProfileId = async (profileId) => {
  return await User.findOne({ profileId });
};

const findUserByIdentifier = async (identifier) => {
  // Try email first, then phone, then username
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(identifier.toLowerCase())) {
    return await findUserByEmail(identifier.toLowerCase());
  }
  // Try username
  return await findUserByUsername(identifier);
};

const findUserByEmailOrPhoneOrUsername = async (email, phoneNumber, username) => {
  return await User.findOne({
    $or: [
      ...(email ? [{ email }] : []),
      ...(phoneNumber ? [{ phoneNumber }] : []),
      ...(username ? [{ username }] : [])
    ]
  });
};

const createUser = async (userData) => {
  const user = new User(userData);
  return await user.save();
};

const updateUser = async (profileId, updateData) => {
  return await User.findOneAndUpdate(
    { profileId },
    updateData,
    { new: true }
  );
};

const findUsersByProfileIds = async (profileIds) => {
  return await User.find({ profileId: { $in: profileIds } });
};

const searchUsersByUsername = async (username, excludeProfileId, limit = 10) => {
  return await User.find({
    username: { $regex: username.trim(), $options: 'i' },
    profileId: { $ne: excludeProfileId }
  })
  .select('username profileId profileImage isOnline fullName lastSeen friendRequests')
  .limit(limit);
};

const updateUserOnlineStatus = async (profileId, isOnline) => {
  return await User.findOneAndUpdate(
    { profileId },
    { isOnline, lastSeen: new Date() },
    { new: true }
  );
};

const setAllUsersOffline = async () => {
  return await User.updateMany({}, { isOnline: false });
};

module.exports = {
  findUserByEmail,
  findUserByPhoneNumber,
  findUserByUsername,
  findUserByProfileId,
  findUserByIdentifier,
  findUserByEmailOrPhoneOrUsername,
  createUser,
  updateUser,
  findUsersByProfileIds,
  searchUsersByUsername,
  updateUserOnlineStatus,
  setAllUsersOffline
};

