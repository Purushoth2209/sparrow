const TempIdMapping = require('../models/TempIdMapping');

/**
 * TempId Repository
 * Handles tempId mapping operations for deduplication
 */

/**
 * Create a mapping between tempId and messageId
 * @param {string} tempId - Client-side temporary ID
 * @param {string} senderId - Sender's profile ID
 * @param {string} messageId - Server message ID
 * @returns {Promise<Object>} Created mapping
 */
async function createMapping(tempId, senderId, messageId) {
  try {
    const mapping = await TempIdMapping.create({
      tempId,
      senderId,
      messageId
    });
    return mapping;
  } catch (error) {
    // Handle duplicate key error (mapping already exists)
    if (error.code === 11000) {
      // Return existing mapping
      return await getMapping(tempId, senderId);
    }
    throw error;
  }
}

/**
 * Get mapping by tempId and senderId
 * @param {string} tempId - Client-side temporary ID
 * @param {string} senderId - Sender's profile ID
 * @returns {Promise<Object|null>} Mapping or null if not found
 */
async function getMapping(tempId, senderId) {
  return await TempIdMapping.findOne({ tempId, senderId });
}

/**
 * Get messageId from tempId
 * @param {string} tempId - Client-side temporary ID
 * @param {string} senderId - Sender's profile ID
 * @returns {Promise<string|null>} Message ID or null
 */
async function getMessageIdByTempId(tempId, senderId) {
  const mapping = await getMapping(tempId, senderId);
  return mapping ? mapping.messageId : null;
}

/**
 * Delete mapping (cleanup)
 * @deprecated Mappings are automatically deleted by MongoDB TTL index after 7 days
 * This function is kept for backward compatibility but should not be used
 * @param {string} tempId - Client-side temporary ID
 * @param {string} senderId - Sender's profile ID
 * @returns {Promise<void>}
 */
async function deleteMapping(tempId, senderId) {
  // Mappings are automatically deleted by TTL index - no manual deletion needed
  // This function is kept for backward compatibility only
  console.warn('⚠️ deleteMapping() called - mappings are automatically deleted by TTL index');
  // Optionally: await TempIdMapping.deleteOne({ tempId, senderId });
}

module.exports = {
  createMapping,
  getMapping,
  getMessageIdByTempId,
  deleteMapping
};


