const friendService = require('../services/friend.service');
const { sendNotificationToUser } = require('../socket');

/**
 * Friend Controller
 * Handles HTTP request/response for friends and friend requests
 */

exports.searchFriends = async (req, res) => {
  try {
    const { username } = req.query;
    const currentUserId = req.user.profileId;

    const friends = await friendService.searchFriends(username, currentUserId);
    res.json({ success: true, friends });
  } catch (error) {
    console.error('❌ Search friends error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while searching friends' 
    });
  }
};

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

    const result = await friendService.sendFriendRequest(fromUserId, toUserId);

    await sendNotificationToUser(toUserId, 'friendRequestReceived', {
      fromUserId: fromUserId,
      username: result.username,
      fullName: result.fullName,
      profileImage: result.profileImage,
      timestamp: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Friend request sent successfully' 
    });
  } catch (error) {
    console.error('❌ Send friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while sending friend request' 
    });
  }
};

exports.getFriendRequests = async (req, res) => {
  try {
    const currentUserId = req.user.profileId;
    const friendRequests = await friendService.getFriendRequests(currentUserId);
    res.json({ success: true, friendRequests });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while fetching friend requests' 
    });
  }
};

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

    const result = await friendService.acceptFriendRequest(currentUserId, fromUserId);

    await sendNotificationToUser(fromUserId, 'friendRequestAccepted', {
      fromUserId: currentUserId,
      username: result.username,
      fullName: result.fullName,
      profileImage: result.profileImage,
      timestamp: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Friend request accepted successfully' 
    });
  } catch (error) {
    console.error('❌ Accept friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while accepting friend request' 
    });
  }
};

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

    const result = await friendService.rejectFriendRequest(currentUserId, fromUserId);

    await sendNotificationToUser(fromUserId, 'friendRequestRejected', {
      fromUserId: currentUserId,
      username: result.username,
      fullName: result.fullName,
      profileImage: result.profileImage,
      timestamp: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Friend request rejected successfully' 
    });
  } catch (error) {
    console.error('❌ Reject friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while rejecting friend request' 
    });
  }
};

exports.getFriends = async (req, res) => {
  try {
    const currentUserId = req.user.profileId;
    const friends = await friendService.getFriends(currentUserId);
    res.json({ success: true, friends });
  } catch (error) {
    console.error('❌ Get friends error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while fetching friends' 
    });
  }
};

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

    const result = await friendService.removeFriend(currentUserId, friendId);

    await sendNotificationToUser(friendId, 'friendUnfriended', {
      fromUserId: currentUserId,
      username: result.username,
      fullName: result.fullName,
      profileImage: result.profileImage,
      timestamp: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Friend removed successfully' 
    });
  } catch (error) {
    console.error('❌ Remove friend error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while removing friend' 
    });
  }
};

