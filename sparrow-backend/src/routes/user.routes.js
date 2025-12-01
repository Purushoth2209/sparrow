/**
 * User Routes
 * 
 * Protected routes for authenticated users.
 * All routes use ensureAuthenticated middleware.
 * Works for both Google OAuth and email/phone login.
 */

const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../middlewares/ensureAuthenticated');
const userController = require('../controllers/user.controller');
const User = require('../models/User');
const { userSockets } = require('../socket');

/**
 * Get Current User
 * 
 * Returns the authenticated user's profile information
 * 
 * @route   GET /api/user
 * @access  Private (requires authentication)
 * @returns {Object} { success: true, user: {...} }
 */
router.get('/user', ensureAuthenticated, userController.getCurrentUser);

/**
 * Get User Profile
 * 
 * Alternative route for getting current user profile
 * 
 * @route   GET /api/profile
 * @access  Private
 */
router.get('/profile', ensureAuthenticated, (req, res) => {
  res.json({ 
    success: true, 
    profile: req.user 
  });
});

/**
 * Debug Session Status
 * 
 * Check session status for debugging
 * 
 * @route   GET /api/session-status
 * @access  Public (for debugging)
 */
router.get('/session-status', (req, res) => {
  res.json({
    success: true,
    hasSession: !!req.session,
    sessionId: req.sessionID,
    hasUser: !!(req.session && req.session.user),
    user: req.session?.user || null
  });
});

/**
 * Debug Online Status
 * 
 * Check online status for debugging
 * 
 * @route   GET /api/online-status
 * @access  Public (for debugging)
 */
router.get('/online-status', async (req, res) => {
  try {
    const onlineUsers = await User.find({ isOnline: true }).select('profileId username isOnline lastSeen');
    
    res.json({
      success: true,
      onlineUsers: onlineUsers,
      connectedSockets: Array.from(userSockets.keys()),
      socketCount: userSockets.size
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Extension: Add more protected user routes here
 * 
 * Examples:
 * - GET /api/user/settings → Get user settings
 * - PUT /api/user/profile → Update user profile
 * - GET /api/user/activity → Get user activity log
 */

module.exports = router;

