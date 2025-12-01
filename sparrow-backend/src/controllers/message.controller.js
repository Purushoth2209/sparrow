const messageService = require('../services/message.service');
const userRepository = require('../repositories/user.repository');
const Message = require('../models/Message');
const { io, userSockets } = require('../socket');

/**
 * Message Controller
 * Handles HTTP request/response for messages
 */

exports.sendMessage = async (senderId, receiverId, content) => {
  return await messageService.sendMessage(senderId, receiverId, content);
};

exports.sendBatchMessages = async (messages) => {
  return await messageService.sendBatchMessages(messages);
};

exports.updateMessageStatus = async (messageId, status) => {
  return await messageService.updateMessageStatus(messageId, status);
};

exports.getDecryptedMessages = async (userId, friendId = null) => {
  return await messageService.getDecryptedMessages(userId, friendId);
};

exports.decryptSingleMessage = async (message) => {
  return await messageService.decryptSingleMessage(message);
};

exports.getEncryptionStats = async () => {
  return await messageService.getEncryptionStats();
};

