const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const { sendMessage, updateMessageStatus, getDecryptedMessages, getEncryptionStats } = require('../controllers/messageController');
const ensureAuthenticated = require('../middleware/ensureAuthenticated');

const router = express.Router();

// Get messages between current user and a friend (with decryption)
router.get('/:friendId', ensureAuthenticated, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUserId = req.user.profileId;

    // Validate friendship
    const currentUser = await User.findOne({ profileId: currentUserId });
    if (!currentUser.friends.includes(friendId)) {
      return res.status(403).json({ error: 'Cannot access messages with non-friend user' });
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
    savedMessage.timestamp = new Date(savedMessage.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Emit message via socket (socket.io will handle decryption for real-time display)
    const { io } = require('../socketio');
    const receiverSocketId = require('../socketio').userSockets.get(receiverId);
    if (receiverSocketId && io) {
      // Update message status to delivered (receiver is online)
      await Message.findByIdAndUpdate(newMessage._id, { 
        status: 'delivered', 
        deliveredAt: new Date() 
      });
      savedMessage.status = 'delivered';
      savedMessage.deliveredAt = new Date();
      
      // Get sender information for notification
      const sender = await User.findOne({ profileId: senderId });
      savedMessage.senderUsername = sender ? sender.username : senderId; // Include username for notifications
      
      // Socket.io will handle decryption when emitting to receiver
      io.to(receiverSocketId).emit('receiveMessage', savedMessage);
    }

    res.status(200).json({ message: savedMessage });
  } catch (err) {
    console.error('❌ Error sending encrypted message:', err);
    res.status(500).json({ error: 'Error sending message' });
  }
});

router.post('/markAsRead', ensureAuthenticated, async (req, res) => {
  try {
    const { senderId } = req.body;
    const receiverId = req.user.profileId;

    // Mark all messages from sender to receiver as read
    const result = await Message.updateMany(
      { senderId: senderId, receiverId: receiverId, status: { $ne: 'read' } },
      { status: 'read', readAt: new Date() }
    );

    // Notify sender via socket
    const { io } = require('../socketio');
    const senderSocketId = require('../socketio').userSockets.get(senderId);
    if (senderSocketId && io) {
      io.to(senderSocketId).emit('messagesRead', {
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

router.post('/updateStatus', ensureAuthenticated, async (req, res) => {
  try {
    const { messageId, status } = req.body;
    const currentUserId = req.user.profileId;

    if (!['sending', 'sent', 'delivered', 'read'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify user has permission to update this message
    if (message.senderId !== currentUserId && message.receiverId !== currentUserId) {
      return res.status(403).json({ error: 'Not authorized to update this message' });
    }

    message.status = status;
    if (status === 'delivered') {
      message.deliveredAt = new Date();
    } else if (status === 'read') {
      message.readAt = new Date();
    }
    
    await message.save();

    res.status(200).json({ message: 'Message status updated' });
  } catch (err) {
    console.error('❌ Error updating message status:', err);
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
