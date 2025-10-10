const Message = require('../models/Message');
const User = require('../models/User');

async function sendMessage(senderId, receiverId, content) {
  try {
    // Validate friendship before sending message
    const sender = await User.findOne({ profileId: senderId });
    if (!sender) {
      throw new Error('Sender not found');
    }

    if (!sender.friends.includes(receiverId)) {
      throw new Error('Cannot send message to non-friend user');
    }

    const message = new Message({
      senderId,
      receiverId,
      content,
      timestamp: new Date(),
    });

    await message.save();
    return message;
  } catch (err) {
    throw err;
  }
}

async function updateMessageStatus(messageId, status) {
  try {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found');

    message.status = status;
    await message.save();
  } catch (err) {
    throw err;
  }
}

const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await User.findByIdAndUpdate(userId, { isOnline });
  } catch (error) {
    throw error;
  }
};

module.exports = {
  sendMessage,
  updateMessageStatus,
  updateUserOnlineStatus
};
