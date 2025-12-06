/**
 * User Routes
 * 
 * Protected routes for user management operations.
 * All routes use ensureAuthenticated middleware which supports both:
 * - Session-based authentication (for web)
 * - JWT token authentication (for mobile)
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const ensureAuthenticated = require('../middlewares/ensureAuthenticated');
const userController = require('../controllers/user.controller');

// Configure multer for file uploads (store in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * GET /api/user/me
 * Get current user's full profile
 * 
 * @route   GET /api/user/me
 * @access  Private
 * @returns {Object} { success: true, user: {...} }
 */
router.get('/user/me', ensureAuthenticated, userController.getCurrentUser);

/**
 * GET /api/user/search?query=xyz
 * Search users globally by username or fullName
 * Must come before /:profileId to avoid route conflicts
 * 
 * @route   GET /api/user/search
 * @access  Private
 * @query   {string} query - Search query (min 2 characters)
 * @returns {Object} { success: true, users: [...] }
 */
router.get('/user/search', ensureAuthenticated, userController.searchUsers);

/**
 * GET /api/user/blocked
 * Get list of blocked users
 * Must come before /:profileId to avoid route conflicts
 * 
 * @route   GET /api/user/blocked
 * @access  Private
 * @returns {Object} { success: true, blockedUsers: [...] }
 */
router.get('/user/blocked', ensureAuthenticated, userController.getBlockedUsers);

/**
 * GET /api/user/:profileId
 * Get limited profile for another user
 * Must come after specific routes like /search and /blocked
 * 
 * @route   GET /api/user/:profileId
 * @access  Private
 * @param   {string} profileId - Target user's profile ID
 * @returns {Object} { success: true, user: {...} }
 */
router.get('/user/:profileId', ensureAuthenticated, userController.getUserProfile);

/**
 * PATCH /api/user/update
 * Update user profile (username, fullName, about)
 * 
 * @route   PATCH /api/user/update
 * @access  Private
 * @body    {string} username - New username (optional)
 * @body    {string} fullName - New full name (optional)
 * @body    {string} about - New about text (optional)
 * @returns {Object} { success: true, user: {...} }
 */
router.patch('/user/update', ensureAuthenticated, userController.updateUser);

/**
 * PUT /api/user/profile/picture
 * Upload profile picture file to S3
 * 
 * @route   PUT /api/user/profile/picture
 * @access  Private
 * @body    {File} image - Image file (multipart/form-data, field name: "image")
 * @returns {Object} { success: true, profileId, profileImage }
 */
router.put(
  '/user/profile/picture',
  ensureAuthenticated,
  upload.single('image'),
  userController.updateProfilePicture
);

/**
 * POST /api/user/profile-picture
 * Upload/set profile picture URL (legacy endpoint - still supported)
 * 
 * @route   POST /api/user/profile-picture
 * @access  Private
 * @body    {string} imageUrl - Profile image URL
 * @returns {Object} { success: true, profileId, profileImage }
 */
router.post('/user/profile-picture', ensureAuthenticated, userController.setProfileImage);

/**
 * DELETE /api/user/profile-picture
 * Delete profile picture
 * 
 * @route   DELETE /api/user/profile-picture
 * @access  Private
 * @returns {Object} { success: true, profileId, profileImage: '' }
 */
router.delete('/user/profile-picture', ensureAuthenticated, userController.deleteProfileImage);

/**
 * DELETE /api/user/delete
 * Delete user account
 * 
 * @route   DELETE /api/user/delete
 * @access  Private
 * @returns {Object} { success: true, message: 'User account deleted successfully' }
 */
router.delete('/user/delete', ensureAuthenticated, userController.deleteUser);

/**
 * POST /api/user/block/:profileId
 * Block a user
 * 
 * @route   POST /api/user/block/:profileId
 * @access  Private
 * @param   {string} profileId - Target user's profile ID to block
 * @returns {Object} { success: true, message, blockedUserId }
 */
router.post('/user/block/:profileId', ensureAuthenticated, userController.blockUser);

/**
 * POST /api/user/unblock/:profileId
 * Unblock a user
 * 
 * @route   POST /api/user/unblock/:profileId
 * @access  Private
 * @param   {string} profileId - Target user's profile ID to unblock
 * @returns {Object} { success: true, message, unblockedUserId }
 */
router.post('/user/unblock/:profileId', ensureAuthenticated, userController.unblockUser);


module.exports = router;
