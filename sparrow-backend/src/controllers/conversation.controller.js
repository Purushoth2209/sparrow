const conversationService = require('../services/conversation.service');

/**
 * Conversation Controller
 * Handles HTTP request/response for conversations
 * All business logic is delegated to conversationService
 */

/**
 * List all conversations for the authenticated user
 * GET /api/conversations
 */
async function listConversations(req, res, next) {
  try {
    const userId = req.user?.profileId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { limit = 50, offset = 0, includeArchived = false } = req.query;

    const conversations = await conversationService.listUserConversations(userId, {
      limit,
      offset,
      includeArchived
    });

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific conversation by ID
 * GET /api/conversations/:id
 */
async function getConversation(req, res, next) {
  try {
    const userId = req.user?.profileId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const conversation = await conversationService.getConversationById(id, userId);

    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Reset unread count for a conversation
 * POST /api/conversations/reset-unread
 */
async function resetUnread(req, res, next) {
  try {
    const userId = req.user?.profileId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { conversationId } = req.body;
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'conversationId is required' });
    }

    const result = await conversationService.resetUnreadCount(conversationId, userId);

    res.json({
      success: true,
      message: 'Unread count reset successfully',
      unreadCount: result.unreadCount
    });
  } catch (error) {
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Delete a conversation (soft delete by archiving)
 * DELETE /api/conversations/:id
 */
async function deleteConversation(req, res, next) {
  try {
    const userId = req.user?.profileId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    await conversationService.archiveConversation(id, userId);

    res.json({
      success: true,
      message: 'Conversation archived successfully'
    });
  } catch (error) {
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ success: false, message: error.message });
    }
    next(error);
  }
}

module.exports = {
  listConversations,
  getConversation,
  resetUnread,
  deleteConversation
};

