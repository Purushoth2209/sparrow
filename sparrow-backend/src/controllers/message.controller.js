const messageService = require('../services/message/message.service');

/**
 * Message Controller
 * Handles HTTP request/response for messages
 * All business logic is delegated to messageService
 */

exports.sendMessage = async (senderId, receiverId, content, tempId) => {
  return await messageService.sendMessage({ senderId, receiverId, content, tempId });
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
