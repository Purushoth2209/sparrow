/**
 * User Routes
 * 
 * Protected routes for authenticated users.
 * All routes use ensureAuthenticated middleware.
 * Works for both Google OAuth and email/phone login.
 */

const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../middleware/ensureAuthenticated');
const authController = require('../controllers/authController');

/**
 * Get Current User
 * 
 * Returns the authenticated user's profile information
 * 
 * @route   GET /api/user
 * @access  Private (requires authentication)
 * @returns {Object} { success: true, user: {...} }
 */
router.get('/user', ensureAuthenticated, authController.getCurrentUser);

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
 * Extension: Add more protected user routes here
 * 
 * Examples:
 * - GET /api/user/settings → Get user settings
 * - PUT /api/user/profile → Update user profile
 * - GET /api/user/activity → Get user activity log
 */

module.exports = router;

