const express = require('express');
const Message = require('../models/Message');
const { sendMessage, updateMessageStatus } = require('../controllers/messageController');

const router = express.Router();

router.post('/send', async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;

    const newMessage = new Message({
      senderId,
      receiverId,
      content,
      status: 'sent',
      timestamp: new Date(),
    });

    await newMessage.save();

    const savedMessage = newMessage.toObject();
    savedMessage.timestamp = savedMessage.timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    sendMessage(receiverId, savedMessage);

    res.status(200).json({ message: savedMessage });
  } catch (err) {
    res.status(500).json({ error: 'Error sending message' });
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
