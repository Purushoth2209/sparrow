const Message = require('../models/Message');

/**
 * Message Repository
 * Contains all database queries related to messages
 */

const createMessage = async (messageData) => {
  const message = new Message(messageData);
  return await message.save();
};

const findMessageById = async (messageId) => {
  return await Message.findById(messageId);
};

const findMessagesByUsers = async (userId, friendId = null) => {
  const query = {
    $or: [
      { senderId: userId },
      { receiverId: userId }
    ]
  };

  if (friendId) {
    query.$and = [
      {
        $or: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId }
        ]
      }
    ];
  }

  return await Message.find(query).sort({ timestamp: -1 });
};

const findUndeliveredMessages = async (receiverId) => {
  return await Message.find({ 
    receiverId: receiverId,
    status: { $ne: 'delivered' }
  }).sort({ timestamp: 1 });
};

const updateMessageStatus = async (messageId, status, additionalData = {}) => {
  return await Message.findByIdAndUpdate(
    messageId,
    { status, ...additionalData },
    { new: true }
  );
};

const updateMessagesStatus = async (query, status, additionalData = {}) => {
  return await Message.updateMany(
    query,
    { status, ...additionalData }
  );
};

const deleteMessage = async (messageId) => {
  return await Message.findByIdAndDelete(messageId);
};

const deleteMessages = async (query) => {
  return await Message.deleteMany(query);
};

const findReadMessages = async (senderId, receiverId, limit = 10) => {
  return await Message.find({
    senderId: senderId,
    receiverId: receiverId,
    status: 'read'
  }).sort({ timestamp: -1 }).limit(limit);
};

const getEncryptionStats = async () => {
  return await Message.getEncryptionStats();
};

module.exports = {
  createMessage,
  findMessageById,
  findMessagesByUsers,
  findUndeliveredMessages,
  updateMessageStatus,
  updateMessagesStatus,
  deleteMessage,
  deleteMessages,
  findReadMessages,
  getEncryptionStats
};

