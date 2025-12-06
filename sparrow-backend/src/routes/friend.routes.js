/**
 * Friend Routes
 * 
 * Routes for friend request system functionality.
 * All routes are protected and require authentication.
 */

const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../middlewares/ensureAuthenticated');
const friendController = require('../controllers/friend.controller');

/**
 * Search Friends by Username
 * 
 * @route   GET /api/search-friends
 * @access  Private
 * @param   {string} username - Username to search for (query parameter)
 * @returns {Object} Array of friends matching username
 */
router.get('/search-friends', ensureAuthenticated, friendController.searchFriends);

/**
 * Send Friend Request
 * 
 * @route   POST /api/send-request
 * @access  Private
 * @body    {string} toUserId - Profile ID of user to send request to
 * @returns {Object} Success/failure message
 */
router.post('/send-request', ensureAuthenticated, friendController.sendFriendRequest);

/**
 * Get Friend Requests
 * 
 * @route   GET /api/friend-requests
 * @access  Private
 * @returns {Object} Array of pending incoming friend requests
 */
router.get('/friend-requests', ensureAuthenticated, friendController.getFriendRequests);

/**
 * Accept Friend Request
 * 
 * @route   POST /api/accept-request
 * @access  Private
 * @body    {string} fromUserId - Profile ID of user who sent the request
 * @returns {Object} Success/failure message
 */
router.post('/accept-request', ensureAuthenticated, friendController.acceptFriendRequest);

/**
 * Reject Friend Request
 * 
 * @route   POST /api/reject-request
 * @access  Private
 * @body    {string} fromUserId - Profile ID of user who sent the request
 * @returns {Object} Success/failure message
 */
router.post('/reject-request', ensureAuthenticated, friendController.rejectFriendRequest);

/**
 * Get Friends List
 * 
 * @route   GET /api/friends
 * @access  Private
 * @returns {Object} Array of friends with their details
 */
router.get('/friends', ensureAuthenticated, friendController.getFriends);

/**
 * Remove Friend
 * 
 * @route   POST /api/remove-friend
 * @access  Private
 * @body    {string} friendId - Profile ID of friend to remove
 * @returns {Object} Success/failure message
 */
router.post('/remove-friend', ensureAuthenticated, friendController.removeFriend);

module.exports = router;