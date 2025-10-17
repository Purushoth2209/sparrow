const User = require('../models/User');
const { io, userSockets } = require('../socketio');

/**
 * Global Search Users by Username
 * 
 * @route GET /api/search-global
 * @access Private
 * @param {string} username - Username to search for
 * @returns {Object} Array of matching users with friendship/request status
 */
exports.searchGlobal = async (req, res) => {
  try {
    const { username } = req.query;
    const currentUserId = req.user.profileId;

    if (!username || username.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be at least 2 characters long' 
      });
    }

    // Get current user to check friends and friend requests
    const currentUser = await User.findOne({ profileId: currentUserId });
    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Current user not found' 
      });
    }

    // Search for users with partial username match, excluding current user
    const users = await User.find({
      username: { $regex: username.trim(), $options: 'i' },
      profileId: { $ne: currentUserId }
    })
    .select('username profileId profileImage isOnline fullName lastSeen friendRequests')
    .limit(10);

    // Add friendship/request status to each user
    const usersWithStatus = users.map(user => {
      let status = 'send_request';
      
      // Check if already friends
      if (currentUser.friends.includes(user.profileId)) {
        status = 'already_friends';
      } else {
        // Check if there's a pending request
        const pendingRequest = user.friendRequests.find(
          request => request.fromUserId === currentUserId && request.status === 'pending'
        );
        if (pendingRequest) {
          status = 'request_sent';
        }
      }

      return {
        profileId: user.profileId,
        username: user.username,
        profileImage: user.profileImage,
        status: status
      };
    });

    res.json({ 
      success: true, 
      users: usersWithStatus
    });

  } catch (error) {
    console.error('❌ Global search error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while searching users' 
    });
  }
};

/**
 * Search Friends by Username
 * 
 * @route GET /api/search-friends
 * @access Private
 * @param {string} username - Username to search for
 * @returns {Object} Array of friends matching username
 */
exports.searchFriends = async (req, res) => {
  try {
    const { username } = req.query;
    const currentUserId = req.user.profileId;

    // Get current user and their friends
    const currentUser = await User.findOne({ profileId: currentUserId });
    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Current user not found' 
      });
    }

    let query = { profileId: { $in: currentUser.friends } };
    
    // Add username filter if provided
    if (username && username.trim().length >= 2) {
      query.username = { $regex: username.trim(), $options: 'i' };
    }

    // Get friends matching the criteria
    const friends = await User.find(query)
      .select('username profileId profileImage isOnline fullName lastSeen')
      .limit(20);

    res.json({ 
      success: true, 
      friends: friends.map(friend => ({
        profileId: friend.profileId,
        username: friend.username,
        fullName: friend.fullName,
        profileImage: friend.profileImage,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen
      }))
    });

  } catch (error) {
    console.error('❌ Search friends error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while searching friends' 
    });
  }
};

/**
 * Send Friend Request
 * 
 * @route POST /api/send-request
 * @access Private
 * @param {string} toUserId - Profile ID of user to send request to
 * @returns {Object} Success/failure message
 */
exports.sendFriendRequest = async (req, res) => {
  try {
    const { toUserId } = req.body;
    const fromUserId = req.user.profileId;

    if (!toUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Target user ID is required' 
      });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot send friend request to yourself' 
      });
    }

    // Check if target user exists
    const targetUser = await User.findOne({ profileId: toUserId });
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if already friends
    const currentUser = await User.findOne({ profileId: fromUserId });
    if (currentUser.friends.includes(toUserId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'You are already friends with this user' 
      });
    }

    // Check if friend request already exists
    const existingRequest = targetUser.friendRequests.find(
      request => request.fromUserId === fromUserId && request.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ 
        success: false, 
        message: 'Friend request already sent to this user' 
      });
    }

    // Add friend request to target user
    targetUser.friendRequests.push({
      fromUserId,
      status: 'pending',
      timestamp: new Date()
    });

    await targetUser.save();

    console.log(`✅ Friend request sent from ${currentUser.username} to ${targetUser.username}`);

    // Emit Socket.IO event to notify the target user
    const targetSocketId = userSockets.get(toUserId);
    if (targetSocketId && io) {
      io.to(targetSocketId).emit('friend_request_received', {
        senderName: currentUser.username,
        senderUsername: currentUser.username,
        senderId: fromUserId,
        timestamp: new Date()
      });
      console.log(`📡 Notified user ${toUserId} about friend request from ${currentUser.username}`);
    }

    res.json({ 
      success: true, 
      message: 'Friend request sent successfully' 
    });

  } catch (error) {
    console.error('❌ Send friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while sending friend request' 
    });
  }
};

/**
 * Get Friend Requests
 * 
 * @route GET /api/friend-requests
 * @access Private
 * @returns {Object} Array of pending incoming friend requests
 */
exports.getFriendRequests = async (req, res) => {
  try {
    const currentUserId = req.user.profileId;

    const user = await User.findOne({ profileId: currentUserId })
      .populate('friendRequests.fromUserId', 'username profileId profileImage fullName');

    const pendingRequests = user.friendRequests
      .filter(request => request.status === 'pending')
      .map(request => ({
        requestId: request._id,
        fromUserId: request.fromUserId,
        timestamp: request.timestamp
      }));

    // Get sender details for each request
    const requestDetails = await Promise.all(
      pendingRequests.map(async (request) => {
        const sender = await User.findOne({ profileId: request.fromUserId })
          .select('username profileId profileImage fullName');
        return {
          requestId: request.requestId,
          fromUserId: request.fromUserId,
          username: sender.username,
          fullName: sender.fullName,
          profileImage: sender.profileImage,
          timestamp: request.timestamp
        };
      })
    );

    res.json({ 
      success: true, 
      friendRequests: requestDetails 
    });

  } catch (error) {
    console.error('❌ Get friend requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching friend requests' 
    });
  }
};

/**
 * Accept Friend Request
 * 
 * @route POST /api/accept-request
 * @access Private
 * @param {string} fromUserId - Profile ID of user who sent the request
 * @returns {Object} Success/failure message
 */
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { fromUserId } = req.body;
    const currentUserId = req.user.profileId;

    if (!fromUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Sender user ID is required' 
      });
    }

    // Find current user and their friend request
    const currentUser = await User.findOne({ profileId: currentUserId });
    const senderUser = await User.findOne({ profileId: fromUserId });

    if (!currentUser || !senderUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Find the pending friend request
    const friendRequest = currentUser.friendRequests.find(
      request => request.fromUserId === fromUserId && request.status === 'pending'
    );

    if (!friendRequest) {
      return res.status(400).json({ 
        success: false, 
        message: 'No pending friend request found' 
      });
    }

    // Update request status to accepted
    friendRequest.status = 'accepted';

    // Add both users to each other's friends array
    if (!currentUser.friends.includes(fromUserId)) {
      currentUser.friends.push(fromUserId);
    }
    if (!senderUser.friends.includes(currentUserId)) {
      senderUser.friends.push(currentUserId);
    }

    // Save both users
    await currentUser.save();
    await senderUser.save();

    console.log(`✅ Friend request accepted between ${currentUser.username} and ${senderUser.username}`);

    // Emit Socket.IO event to notify the sender
    const senderSocketId = userSockets.get(fromUserId);
    if (senderSocketId && io) {
      io.to(senderSocketId).emit('friend_request_accepted', {
        accepterName: currentUser.username,
        accepterUsername: currentUser.username,
        accepterId: currentUserId,
        timestamp: new Date()
      });
      console.log(`📡 Notified user ${fromUserId} about friend request acceptance by ${currentUser.username}`);
    }

    res.json({ 
      success: true, 
      message: 'Friend request accepted successfully' 
    });

  } catch (error) {
    console.error('❌ Accept friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while accepting friend request' 
    });
  }
};

/**
 * Reject Friend Request
 * 
 * @route POST /api/reject-request
 * @access Private
 * @param {string} fromUserId - Profile ID of user who sent the request
 * @returns {Object} Success/failure message
 */
exports.rejectFriendRequest = async (req, res) => {
  try {
    const { fromUserId } = req.body;
    const currentUserId = req.user.profileId;

    if (!fromUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Sender user ID is required' 
      });
    }

    // Find current user
    const currentUser = await User.findOne({ profileId: currentUserId });

    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Find and remove the pending friend request
    const requestIndex = currentUser.friendRequests.findIndex(
      request => request.fromUserId === fromUserId && request.status === 'pending'
    );

    if (requestIndex === -1) {
      return res.status(400).json({ 
        success: false, 
        message: 'No pending friend request found' 
      });
    }

    // Remove the friend request
    currentUser.friendRequests.splice(requestIndex, 1);
    await currentUser.save();

    console.log(`✅ Friend request rejected from ${fromUserId} to ${currentUser.username}`);

    // Emit Socket.IO event to notify the sender
    const senderSocketId = userSockets.get(fromUserId);
    if (senderSocketId && io) {
      io.to(senderSocketId).emit('friend_request_rejected', {
        rejecterName: currentUser.username,
        rejecterUsername: currentUser.username,
        rejecterId: currentUserId,
        timestamp: new Date()
      });
      console.log(`📡 Notified user ${fromUserId} about friend request rejection by ${currentUser.username}`);
    }

    res.json({ 
      success: true, 
      message: 'Friend request rejected successfully' 
    });

  } catch (error) {
    console.error('❌ Reject friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while rejecting friend request' 
    });
  }
};

/**
 * Get Friends List
 * 
 * @route GET /api/friends
 * @access Private
 * @returns {Object} Array of friends with their details
 */
exports.getFriends = async (req, res) => {
  try {
    const currentUserId = req.user.profileId;

    const user = await User.findOne({ profileId: currentUserId });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Get friend details
    const friends = await User.find({ profileId: { $in: user.friends } })
      .select('username profileId profileImage fullName isOnline socketId');

    const friendsList = friends.map(friend => ({
      profileId: friend.profileId,
      username: friend.username,
      fullName: friend.fullName,
      profileImage: friend.profileImage,
      isOnline: friend.isOnline
    }));

    res.json({ 
      success: true, 
      friends: friendsList 
    });

  } catch (error) {
    console.error('❌ Get friends error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching friends' 
    });
  }
};

/**
 * Remove Friend
 * 
 * @route POST /api/remove-friend
 * @access Private
 * @param {string} friendId - Profile ID of friend to remove
 * @returns {Object} Success/failure message
 */
exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const currentUserId = req.user.profileId;

    if (!friendId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Friend ID is required' 
      });
    }

    if (currentUserId === friendId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot remove yourself as a friend' 
      });
    }

    // Find both users
    const currentUser = await User.findOne({ profileId: currentUserId });
    const friendUser = await User.findOne({ profileId: friendId });

    if (!currentUser || !friendUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if they are actually friends
    if (!currentUser.friends.includes(friendId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'This user is not your friend' 
      });
    }

    // Remove friend from both users' friends arrays
    currentUser.friends = currentUser.friends.filter(id => id !== friendId);
    friendUser.friends = friendUser.friends.filter(id => id !== currentUserId);

    // Save both users
    await currentUser.save();
    await friendUser.save();

    console.log(`✅ Friend removed: ${currentUser.username} removed ${friendUser.username}`);

    // Emit Socket.IO event to notify the removed friend
    const removedFriendSocketId = userSockets.get(friendId);
    if (removedFriendSocketId && io) {
      io.to(removedFriendSocketId).emit('friend_unfriended', {
        unfrienderName: currentUser.username,
        unfrienderUsername: currentUser.username,
        unfrienderId: currentUserId,
        timestamp: new Date()
      });
      console.log(`📡 Notified user ${friendId} about being unfriended by ${currentUser.username}`);
    }

    res.json({ 
      success: true, 
      message: 'Friend removed successfully' 
    });

  } catch (error) {
    console.error('❌ Remove friend error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while removing friend' 
    });
  }
};
