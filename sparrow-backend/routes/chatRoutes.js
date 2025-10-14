const express = require('express');
const { getChatList, getConversation, markConversationAsRead, getChatStats } = require('../controllers/chatController');
const ensureAuthenticated = require('../middleware/ensureAuthenticated');

const router = express.Router();

/**
 * Chat Routes
 * 
 * Provides API endpoints for chat list management and conversation handling
 */

// Get user's chat list ordered by latest message
router.get('/list', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.profileId;
    const chatList = await getChatList(userId);
    
    res.status(200).json({
      success: true,
      message: 'Chat list retrieved successfully',
      data: {
        chats: chatList,
        totalChats: chatList.length
      }
    });
  } catch (error) {
    console.error('❌ Error getting chat list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat list',
      message: error.message
    });
  }
});

// Get conversation with a specific friend
router.get('/conversation/:friendId', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.profileId;
    const { friendId } = req.params;
    
    const conversation = await getConversation(userId, friendId);
    
    res.status(200).json({
      success: true,
      message: 'Conversation retrieved successfully',
      data: conversation
    });
  } catch (error) {
    console.error('❌ Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation',
      message: error.message
    });
  }
});

// Mark conversation as read
router.post('/conversation/:friendId/read', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.profileId;
    const { friendId } = req.params;
    
    const result = await markConversationAsRead(userId, friendId);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        updatedCount: result.updatedCount
      }
    });
  } catch (error) {
    console.error('❌ Error marking conversation as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark conversation as read',
      message: error.message
    });
  }
});

// Get chat statistics
router.get('/stats', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.profileId;
    const stats = await getChatStats(userId);
    
    res.status(200).json({
      success: true,
      message: 'Chat statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('❌ Error getting chat stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat statistics',
      message: error.message
    });
  }
});

module.exports = router;
