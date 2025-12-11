const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversation.controller');
const authAny = require('../middlewares/authAny.middleware');

/**
 * Conversation Routes
 * All routes require authentication
 */

// Get all conversations for the authenticated user
router.get('/', authAny, conversationController.listConversations);

// Get a specific conversation by ID
router.get('/:id', authAny, conversationController.getConversation);

// Reset unread count for a conversation
router.post('/reset-unread', authAny, conversationController.resetUnread);

// Delete (archive) a conversation
router.delete('/:id', authAny, conversationController.deleteConversation);

module.exports = router;

