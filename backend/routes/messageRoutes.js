const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const { sendMessage, updateMessageStatus } = require('../controllers/messageController');
const ensureAuthenticated = require('../middleware/ensureAuthenticated');

const router = express.Router();

// Get messages between current user and a friend
router.get('/:friendId', ensureAuthenticated, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUserId = req.user.profileId;

    // Validate friendship
    const currentUser = await User.findOne({ profileId: currentUserId });
    if (!currentUser.friends.includes(friendId)) {
      return res.status(403).json({ error: 'Cannot access messages with non-friend user' });
    }

    // Get messages between users
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: friendId },
        { senderId: friendId, receiverId: currentUserId }
      ]
    }).sort({ timestamp: 1 });

    res.status(200).json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

router.post('/send', ensureAuthenticated, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user.profileId;

    // Validate friendship before sending
    const currentUser = await User.findOne({ profileId: senderId });
    if (!currentUser.friends.includes(receiverId)) {
      return res.status(403).json({ error: 'Cannot send message to non-friend user' });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      content,
      timestamp: new Date(),
      status: 'sent'
    });

    await newMessage.save();

    const savedMessage = newMessage.toObject();
    savedMessage.timestamp = savedMessage.timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Emit message via socket
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
      
      io.to(receiverSocketId).emit('receiveMessage', savedMessage);
    }

    res.status(200).json({ message: savedMessage });
  } catch (err) {
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

module.exports = router;
