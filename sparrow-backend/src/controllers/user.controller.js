const userService = require('../services/user.service');

/**
 * User Controller
 * Handles HTTP request/response for user operations
 */

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await userService.getCurrentUser(req.user.profileId);
    res.json({ success: true, user });
  } catch (error) {
    res.status(404).json({ 
      success: false, 
      error: error.message || 'User not found' 
    });
  }
};

