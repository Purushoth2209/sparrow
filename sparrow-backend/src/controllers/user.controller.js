const userService = require('../services/user.service');
const { errorResponse } = require('../utils/response');

/**
 * User Controller
 * Handles HTTP request/response for user operations
 * No business logic - delegates to service layer
 */

/**
 * GET /api/user/me
 * Get current user's full profile
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const profileId = req.user.profileId;
    const user = await userService.getCurrentUser(profileId);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    res.status(404).json({
      success: false,
      error: error.message || 'User not found'
    });
  }
};

/**
 * GET /api/user/:profileId
 * Get limited profile for another user
 */
exports.getUserProfile = async (req, res) => {
  try {
    const { profileId } = req.params;
    const currentUserId = req.user.profileId;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: 'Profile ID is required'
      });
    }

    const user = await userService.getUserProfile(profileId, currentUserId);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    res.status(404).json({
      success: false,
      error: error.message || 'User not found'
    });
  }
};

/**
 * GET /api/user/search?query=xyz
 * Search users globally by username or fullName
 */
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.user.profileId;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        users: []
      });
    }

    const users = await userService.searchUsers(query, currentUserId);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error in searchUsers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed'
    });
  }
};

/**
 * PATCH /api/user/update
 * Update user profile (username, fullName, about)
 */
exports.updateUser = async (req, res) => {
  try {
    const profileId = req.user.profileId;
    const { username, fullName, about } = req.body;

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (about !== undefined) updateData.about = about;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (username, fullName, about) must be provided'
      });
    }

    const updatedUser = await userService.updateUser(profileId, updateData);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error in updateUser:', error);
    
    // Handle specific validation errors
    if (error.message.includes('already taken') || 
        error.message.includes('cannot be empty') ||
        error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Update failed'
    });
  }
};

/**
 * POST /api/user/profile-picture
 * Upload/set profile picture URL
 */
exports.setProfileImage = async (req, res) => {
  try {
    const profileId = req.user.profileId;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'imageUrl is required'
      });
    }

    const result = await userService.setProfileImage(profileId, imageUrl);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in setProfileImage:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set profile image'
    });
  }
};

/**
 * PUT /api/user/profile/picture
 * Update profile picture with file upload to S3
 */
exports.updateProfilePicture = async (req, res) => {
  try {
    const profileId = req.user.profileId;
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required. Please upload an image file.'
      });
    }

    // Call service to handle upload and update
    const result = await userService.updateProfilePicture(profileId, req.file);
    
    res.json({ 
      success: true, 
      message: 'Profile picture updated successfully',
      ...result 
    });
  } catch (error) {
    console.error('Error in updateProfilePicture:', error);
    
    // Handle specific error types
    if (error.message.includes('Invalid image type') || 
        error.message.includes('File size exceeds') ||
        error.message.includes('Image file is required')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profile picture'
    });
  }
};

/**
 * DELETE /api/user/profile-picture
 * Delete profile picture
 */
exports.deleteProfileImage = async (req, res) => {
  try {
    const profileId = req.user.profileId;
    const result = await userService.deleteProfileImage(profileId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in deleteProfileImage:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete profile image'
    });
  }
};

/**
 * DELETE /api/user/delete
 * Delete user account
 */
exports.deleteUser = async (req, res) => {
  try {
    const profileId = req.user.profileId;
    const result = await userService.deleteUser(profileId);
    
    // Destroy session if it exists
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user account'
    });
  }
};

/**
 * POST /api/user/block/:profileId
 * Block a user
 */
exports.blockUser = async (req, res) => {
  try {
    const currentUserId = req.user.profileId;
    const { profileId } = req.params;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: 'Profile ID is required'
      });
    }

    const result = await userService.blockUser(currentUserId, profileId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in blockUser:', error);
    
    if (error.message.includes('Cannot block yourself') ||
        error.message.includes('already blocked')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(404).json({
      success: false,
      error: error.message || 'User not found'
    });
  }
};

/**
 * POST /api/user/unblock/:profileId
 * Unblock a user
 */
exports.unblockUser = async (req, res) => {
  try {
    const currentUserId = req.user.profileId;
    const { profileId } = req.params;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: 'Profile ID is required'
      });
    }

    const result = await userService.unblockUser(currentUserId, profileId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in unblockUser:', error);
    
    if (error.message.includes('Cannot unblock yourself') ||
        error.message.includes('not blocked')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to unblock user'
    });
  }
};

/**
 * GET /api/user/blocked
 * Get list of blocked users
 */
exports.getBlockedUsers = async (req, res) => {
  try {
    const profileId = req.user.profileId;
    const blockedUsers = await userService.getBlockedUsers(profileId);
    res.json({ success: true, blockedUsers });
  } catch (error) {
    console.error('Error in getBlockedUsers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get blocked users'
    });
  }
};
