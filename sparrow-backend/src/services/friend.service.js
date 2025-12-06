const userRepository = require('../repositories/user.repository');
const friendRepository = require('../repositories/friend.repository');

/**
 * Friend Service
 * Contains business logic for friends and friend requests
 */

async function searchFriends(username, currentUserId) {
  const currentUser = await userRepository.findUserByProfileId(currentUserId);
  if (!currentUser) {
    throw new Error('Current user not found');
  }

  let query = { profileId: { $in: currentUser.friends } };
  
  if (username && username.trim().length >= 2) {
    query.username = { $regex: username.trim(), $options: 'i' };
  }

  const friends = await userRepository.findUsersByProfileIds(currentUser.friends);
  const filteredFriends = friends
    .filter(friend => !username || friend.username.toLowerCase().includes(username.toLowerCase()))
    .slice(0, 20);

  return filteredFriends.map(friend => ({
    profileId: friend.profileId,
    username: friend.username,
    fullName: friend.fullName,
    profileImage: friend.profileImage,
    isOnline: friend.isOnline,
    lastSeen: friend.lastSeen
  }));
}

async function sendFriendRequest(fromUserId, toUserId) {
  if (fromUserId === toUserId) {
    throw new Error('Cannot send friend request to yourself');
  }

  const targetUser = await userRepository.findUserByProfileId(toUserId);
  if (!targetUser) {
    throw new Error('User not found');
  }

  const currentUser = await userRepository.findUserByProfileId(fromUserId);
  if (currentUser.friends.includes(toUserId)) {
    throw new Error('You are already friends with this user');
  }

  const existingRequest = await friendRepository.findFriendRequest(toUserId, fromUserId);
  if (existingRequest) {
    throw new Error('Friend request already sent to this user');
  }

  await friendRepository.addFriendRequest(toUserId, fromUserId);

  return {
    fromUserId,
    username: currentUser.username,
    fullName: currentUser.fullName,
    profileImage: currentUser.profileImage
  };
}

async function getFriendRequests(currentUserId) {
  const pendingRequests = await friendRepository.getPendingFriendRequests(currentUserId);

  const requestDetails = await Promise.all(
    pendingRequests.map(async (request) => {
      const sender = await userRepository.findUserByProfileId(request.fromUserId);
      return {
        requestId: request._id,
        fromUserId: request.fromUserId,
        username: sender.username,
        fullName: sender.fullName,
        profileImage: sender.profileImage,
        timestamp: request.timestamp
      };
    })
  );

  return requestDetails;
}

async function acceptFriendRequest(currentUserId, fromUserId) {
  if (!fromUserId) {
    throw new Error('Sender user ID is required');
  }

  const currentUser = await userRepository.findUserByProfileId(currentUserId);
  const senderUser = await userRepository.findUserByProfileId(fromUserId);

  if (!currentUser || !senderUser) {
    throw new Error('User not found');
  }

  const friendRequest = await friendRepository.findFriendRequest(currentUserId, fromUserId);
  if (!friendRequest) {
    throw new Error('No pending friend request found');
  }

  await friendRepository.updateFriendRequestStatus(currentUserId, fromUserId, 'accepted');
  await friendRepository.addFriendToUser(currentUserId, fromUserId);
  await friendRepository.addFriendToUser(fromUserId, currentUserId);

  return {
    fromUserId: currentUserId,
    username: currentUser.username,
    fullName: currentUser.fullName,
    profileImage: currentUser.profileImage
  };
}

async function rejectFriendRequest(currentUserId, fromUserId) {
  if (!fromUserId) {
    throw new Error('Sender user ID is required');
  }

  const currentUser = await userRepository.findUserByProfileId(currentUserId);
  if (!currentUser) {
    throw new Error('User not found');
  }

  const friendRequest = await friendRepository.findFriendRequest(currentUserId, fromUserId);
  if (!friendRequest) {
    throw new Error('No pending friend request found');
  }

  await friendRepository.removeFriendRequest(currentUserId, fromUserId);

  return {
    fromUserId: currentUserId,
    username: currentUser.username,
    fullName: currentUser.fullName,
    profileImage: currentUser.profileImage
  };
}

async function getFriends(currentUserId) {
  const user = await userRepository.findUserByProfileId(currentUserId);
  if (!user) {
    throw new Error('User not found');
  }

  const friends = await userRepository.findUsersByProfileIds(user.friends);

  return friends.map(friend => ({
    profileId: friend.profileId,
    username: friend.username,
    fullName: friend.fullName,
    profileImage: friend.profileImage,
    isOnline: friend.isOnline
  }));
}

async function removeFriend(currentUserId, friendId) {
  if (currentUserId === friendId) {
    throw new Error('Cannot remove yourself as a friend');
  }

  const currentUser = await userRepository.findUserByProfileId(currentUserId);
  const friendUser = await userRepository.findUserByProfileId(friendId);

  if (!currentUser || !friendUser) {
    throw new Error('User not found');
  }

  if (!currentUser.friends.includes(friendId)) {
    throw new Error('This user is not your friend');
  }

  await friendRepository.removeFriendFromUser(currentUserId, friendId);
  await friendRepository.removeFriendFromUser(friendId, currentUserId);

  return {
    fromUserId: currentUserId,
    username: currentUser.username,
    fullName: currentUser.fullName,
    profileImage: currentUser.profileImage
  };
}

module.exports = {
  searchFriends,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  removeFriend
};

