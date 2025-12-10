const User = require('../models/User');
const friendRequestStates = require('../constants/friendRequestStates');

/**
 * Friend Repository
 * Contains all database queries related to friends and friend requests
 */

const findUserWithFriends = async (profileId) => {
  return await User.findOne({ profileId });
};

const addFriendToUser = async (profileId, friendId) => {
  const user = await User.findOne({ profileId });
  if (user && !user.friends.includes(friendId)) {
    user.friends.push(friendId);
    return await user.save();
  }
  return user;
};

const removeFriendFromUser = async (profileId, friendId) => {
  const user = await User.findOne({ profileId });
  if (user) {
    user.friends = user.friends.filter(id => id !== friendId);
    return await user.save();
  }
  return user;
};

const addFriendRequest = async (toUserId, fromUserId) => {
  const user = await User.findOne({ profileId: toUserId });
  if (user) {
    user.friendRequests.push({
      fromUserId,
      status: friendRequestStates.PENDING,
      timestamp: new Date()
    });
    return await user.save();
  }
  return user;
};

const findFriendRequest = async (toUserId, fromUserId) => {
  const user = await User.findOne({ profileId: toUserId });
  if (user) {
    return user.friendRequests.find(
      request => request.fromUserId === fromUserId && request.status === friendRequestStates.PENDING
    );
  }
  return null;
};

const updateFriendRequestStatus = async (toUserId, fromUserId, status) => {
  const user = await User.findOne({ profileId: toUserId });
  if (user) {
    const request = user.friendRequests.find(
      req => req.fromUserId === fromUserId && req.status === friendRequestStates.PENDING
    );
    if (request) {
      request.status = status;
      return await user.save();
    }
  }
  return user;
};

const removeFriendRequest = async (toUserId, fromUserId) => {
  const user = await User.findOne({ profileId: toUserId });
  if (user) {
    user.friendRequests = user.friendRequests.filter(
      request => !(request.fromUserId === fromUserId && request.status === friendRequestStates.PENDING)
    );
    return await user.save();
  }
  return user;
};

const getPendingFriendRequests = async (profileId) => {
  const user = await User.findOne({ profileId });
  if (user) {
    return user.friendRequests.filter(request => request.status === friendRequestStates.PENDING);
  }
  return [];
};

module.exports = {
  findUserWithFriends,
  addFriendToUser,
  removeFriendFromUser,
  addFriendRequest,
  findFriendRequest,
  updateFriendRequestStatus,
  removeFriendRequest,
  getPendingFriendRequests
};

