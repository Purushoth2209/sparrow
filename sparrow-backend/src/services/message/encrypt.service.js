const OptimizedKMSEnvelopeEncryption = require('../../utils/optimizedKmsEncryption');
const messageConfig = require('../../config/message');

/**
 * Encryption Service
 * Wraps the existing KMS encryption logic without modification
 * Provides clean interface for message encryption/decryption
 * 
 * Auto-Key Rotation:
 * - Rotates DEK every 24 hours (time-based)
 * - Rotates DEK every 1000 messages per session (count-based)
 * - Ensures forward secrecy and prevents DEK reuse
 */

// Initialize the optimized encryption service with DEK caching and auto-rotation
const encryptionService = new OptimizedKMSEnvelopeEncryption({
  dekRotationInterval: 30 * 60 * 1000, // 30 minutes (for cache cleanup)
  dekMaxAge: 60 * 60 * 1000, // 1 hour max age (for cache cleanup)
  dekRotationPeriodHours: messageConfig.dekRotationPeriodHours || 24, // Auto-rotate every 24 hours
  dekRotationMessages: messageConfig.dekRotationMessages || 1000, // Auto-rotate every 1000 messages
  batchTimeout: 50, // 50ms batch window
  batchSize: 10 // Max 10 messages per batch
});

/**
 * Encrypt message content
 * @param {string} content - Plain text message content
 * @param {string} sessionKey - Session ID (typically `${senderId}-${receiverId}`)
 * @returns {Promise<Object>} Encrypted package with all encryption metadata
 */
async function encryptContent(content, sessionKey) {
  return await encryptionService.encryptMessageOptimized(content, sessionKey);
}

/**
 * Decrypt message content
 * @param {Object} encryptedPackage - Encrypted message package
 * @param {string} sessionKey - Session ID for DEK caching
 * @returns {Promise<string>} Decrypted plain text content
 */
async function decryptContent(encryptedPackage, sessionKey) {
  return await encryptionService.decryptMessageOptimized(encryptedPackage, sessionKey);
}

/**
 * Batch encrypt multiple messages
 * @param {Array} messages - Array of {id, content} objects
 * @param {string} sessionKey - Session ID
 * @returns {Promise<Array>} Array of encrypted packages
 */
async function batchEncryptMessages(messages, sessionKey) {
  return await encryptionService.batchEncryptMessages(messages, sessionKey);
}

/**
 * Get encryption statistics
 * @returns {Object} Encryption stats including cache hit rate, KMS calls, etc.
 */
function getEncryptionStats() {
  return encryptionService.getStats();
}

/**
 * Rotate DEK for a session (for forward secrecy)
 * @param {string} sessionKey - Session ID
 * @returns {Promise<void>}
 */
async function rotateSessionDEK(sessionKey) {
  return await encryptionService.rotateSessionDEK(sessionKey);
}

module.exports = {
  encryptContent,
  decryptContent,
  batchEncryptMessages,
  getEncryptionStats,
  rotateSessionDEK,
  encryptionService // Export for backward compatibility
};

