const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const { sendMessage, sendBatchMessages, updateMessageStatus, getDecryptedMessages, getEncryptionStats } = require('../controllers/message.controller');
const ensureAuthenticated = require('../middlewares/ensureAuthenticated');
const userRepository = require('../repositories/user.repository');
const messageService = require('../services/message.service');
const { io, userSockets } = require('../socket');

const router = express.Router();

// Get messages between current user and a friend (with decryption)
router.get('/:friendId', ensureAuthenticated, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUserId = req.user.profileId;

    // Validate friendship
    const currentUser = await userRepository.findUserByProfileId(currentUserId);
    if (!currentUser.friends.includes(friendId)) {
      return res.status(403).json({ error: 'Cannot access messages with non-friend user' });
    }

    // Check blocking status
    const targetUser = await userRepository.findUserByProfileId(friendId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if current user has blocked target user
    const currentUserBlockedTarget = currentUser.blockedUsers?.some(
      blocked => blocked.profileId === friendId
    );
    if (currentUserBlockedTarget) {
      return res.status(403).json({ error: 'Cannot access messages with blocked user' });
    }

    // Check if target user has blocked current user
    const targetUserBlockedCurrent = targetUser.blockedUsers?.some(
      blocked => blocked.profileId === currentUserId
    );
    if (targetUserBlockedCurrent) {
      return res.status(403).json({ error: 'Cannot access messages. You have been blocked by this user' });
    }

    // Get and decrypt messages between users
    const messages = await getDecryptedMessages(currentUserId, friendId);

    res.status(200).json({ messages });
  } catch (err) {
    console.error('❌ Error fetching encrypted messages:', err);
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

// Send encrypted message
router.post('/send', ensureAuthenticated, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user.profileId;

    // Use the encrypted message controller
    const newMessage = await sendMessage(senderId, receiverId, content);

    const savedMessage = newMessage;
    // Keep timestamp as ISO string for frontend to handle timezone conversion
    savedMessage.timestamp = new Date(savedMessage.timestamp).toISOString();

    // Emit message via socket (socket.io will handle decryption for real-time display)
    const socketIO = io();
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId && socketIO) {
      // Update message status to delivered (receiver is online)
      await Message.findByIdAndUpdate(newMessage._id, { 
        status: 'delivered', 
        deliveredAt: new Date() 
      });
      savedMessage.status = 'delivered';
      savedMessage.deliveredAt = new Date();
      
      // Socket.io will handle decryption when emitting to receiver
      socketIO.to(receiverSocketId).emit('receiveMessage', savedMessage);
    }

    res.status(200).json({ message: savedMessage });
  } catch (err) {
    console.error('❌ Error sending encrypted message:', err);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Send multiple messages in batch (optimized for performance)
router.post('/send/batch', ensureAuthenticated, async (req, res) => {
  try {
    const { messages } = req.body; // Array of {receiverId, content} objects
    const senderId = req.user.profileId;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required and cannot be empty' });
    }

    if (messages.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 messages per batch' });
    }

    // Add senderId to each message
    const messagesWithSender = messages.map(msg => ({
      ...msg,
      senderId: senderId
    }));

    // Use the batch message controller for optimized encryption
    const savedMessages = await sendBatchMessages(messagesWithSender);

    // Keep timestamps as ISO strings for frontend timezone handling
    const formattedMessages = savedMessages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp).toISOString()
    }));

    // Emit messages via socket for real-time delivery
    const socketIO = io();
    if (socketIO) {
      for (const message of formattedMessages) {
        const receiverSocketId = userSockets.get(message.receiverId);
        if (receiverSocketId) {
          // Update message status to delivered (receiver is online)
          await Message.findByIdAndUpdate(message._id, { 
            status: 'delivered', 
            deliveredAt: new Date() 
          });
          message.status = 'delivered';
          message.deliveredAt = new Date();
          
          // Socket.io will handle decryption when emitting to receiver
          socketIO.to(receiverSocketId).emit('receiveMessage', message);
        }
      }
    }

    res.status(200).json({ 
      message: 'Batch messages sent successfully',
      messages: formattedMessages,
      count: formattedMessages.length
    });
  } catch (err) {
    console.error('❌ Error sending batch messages:', err);
    res.status(500).json({ error: 'Error sending batch messages' });
  }
});

router.post('/markAsRead', ensureAuthenticated, async (req, res) => {
  try {
    const { senderId } = req.body;
    const receiverId = req.user.profileId;

    // Mark all messages from sender to receiver as read
    const result = await messageService.markMessagesAsRead(senderId, receiverId);

    // Notify sender via socket
    const socketIO = io();
    const senderSocketId = userSockets.get(senderId);
    if (senderSocketId && socketIO) {
      socketIO.to(senderSocketId).emit('messagesRead', {
        receiverId: receiverId,
        readAt: new Date()
      });
    }

    res.status(200).json({ 
      message: 'Messages marked as read',
      updatedCount: result.modifiedCount 
    });
  } catch (err) {
    res.status(500).json({ error: 'Error marking messages as read' });
  }
});

router.post('/updateStatus', async (req, res) => {
  try {
    const { messageId, status } = req.body;

    if (!['sent', 'delivered', 'read'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.status = status;
    await message.save();

    res.status(200).json({ message: 'Message status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating message status' });
  }
});

// Get encryption statistics (admin/monitoring endpoint)
router.get('/stats/encryption', ensureAuthenticated, async (req, res) => {
  try {
    const stats = await getEncryptionStats();
    res.status(200).json({ 
      message: 'Encryption statistics retrieved successfully',
      stats 
    });
  } catch (err) {
    console.error('❌ Error getting encryption stats:', err);
    res.status(500).json({ error: 'Error retrieving encryption statistics' });
  }
});

// Get all messages for current user (with decryption)
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user.profileId;
    const messages = await getDecryptedMessages(currentUserId);
    
    res.status(200).json({ 
      message: 'Messages retrieved successfully',
      messages 
    });
  } catch (err) {
    console.error('❌ Error fetching all encrypted messages:', err);
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

module.exports = router;
