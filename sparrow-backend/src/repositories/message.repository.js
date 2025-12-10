const Message = require('../models/Message');
const messageStates = require('../constants/messageStates');

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
    status: { $ne: messageStates.DELIVERED }
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

/**
 * ⚠️ DEPRECATED: Messages should NOT be manually deleted
 * Messages are automatically deleted by MongoDB TTL index after expireAt (7 days)
 * 
 * These methods are kept for migration/cleanup scripts only.
 * DO NOT use in normal message flow.
 */
const deleteMessage = async (messageId) => {
  console.warn('⚠️ deleteMessage() called - messages should only be deleted by TTL');
  return await Message.findByIdAndDelete(messageId);
};

const deleteMessages = async (query) => {
  console.warn('⚠️ deleteMessages() called - messages should only be deleted by TTL');
  return await Message.deleteMany(query);
};

const findReadMessages = async (senderId, receiverId, limit = 10) => {
  return await Message.find({
    senderId: senderId,
    receiverId: receiverId,
    status: messageStates.READ
  }).sort({ timestamp: -1 }).limit(limit);
};

const getEncryptionStats = async () => {
  return await Message.getEncryptionStats();
};

const saveMessage = async (messageData) => {
  const message = new Message(messageData);
  return await message.save();
};

const findMessagesByFriendId = async (senderId, receiverId) => {
  return await Message.find({
    $or: [
      { senderId: senderId, receiverId: receiverId },
      { senderId: receiverId, receiverId: senderId }
    ]
  }).sort({ timestamp: -1 });
};

const findMessagesSince = async (profileId, timestamp) => {
  return await Message.find({
    receiverId: profileId,
    $or: [
      { serverTimestamp: { $gte: timestamp } },
      { timestamp: { $gte: timestamp } } // Fallback for legacy messages
    ]
  }).sort({ serverTimestamp: 1, timestamp: 1 }); // Sort ascending for chronological order
};

const findMessageByTempId = async (senderId, tempId) => {
  // Use tempId repository for proper lookup
  const tempIdRepository = require('./tempId.repository');
  const messageId = await tempIdRepository.getMessageIdByTempId(tempId, senderId);
  if (!messageId) {
    return null;
  }
  return await Message.findById(messageId);
};

module.exports = {
  createMessage,
  saveMessage, // Alias for createMessage
  findMessageById,
  findMessagesByUsers,
  findMessagesByFriendId,
  findMessagesSince,
  findUndeliveredMessages,
  updateMessageStatus,
  updateMessagesStatus,
  deleteMessage,
  deleteMessages,
  findReadMessages,
  getEncryptionStats,
  findMessageByTempId
};

