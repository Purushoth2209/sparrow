/**
 * Outbound Queue Service
 * 
 * Handles adding messages to the outbound queue for offline support.
 * Messages are added immediately to the queue and appear in UI instantly.
 * 
 * 🎯 ARCHITECTURAL RULE 2: Queue only transports messages
 * - Queue is ONLY for sending messages to server
 * - Queue does NOT store message history
 * - Messages are removed from queue after successful send
 * - Message history is stored in IndexedDB messages store, not queue
 */

import { addToQueue } from '../client-db/queue.db';
import { addMessage } from '../client-db/message.db';
import { generateTempId } from '../shared/utils/uuid';

/**
 * Add a message to the outbound queue
 * This is called whenever a user sends a message.
 * The message is added to both the queue and the messages store for immediate UI display.
 * 
 * @param {string} senderId - Sender user ID
 * @param {string} receiverId - Receiver user ID
 * @param {string} content - Message content
 * @param {Object} options - Additional options
 * @param {string} options.tempId - Optional custom tempId (if not provided, one will be generated)
 * @param {string} options.encryptedContent - Optional encrypted content
 * @returns {Promise<Object>} Object with tempId and queueId
 */
export const enqueueMessage = async (senderId, receiverId, content, options = {}) => {
  const tempId = options.tempId || generateTempId();
  const timestamp = Date.now();

  // Create message object for local storage
  const message = {
    tempId,
    senderId,
    receiverId,
    content,
    encryptedContent: options.encryptedContent,
    status: 'pending', // pending -> sending -> sent -> delivered -> read
    timestamp,
  };

  // Add to queue (for processing)
  const queueId = await addToQueue({
    tempId,
    senderId,
    receiverId,
    content,
    timestamp,
    retryCount: 0,
  });

  // Add to messages store (for UI display)
  const messageId = await addMessage(message);

  // Note: tempId mapping will be created when server responds with messageId
  // We don't create it here because addTempIdMapping requires a messageId

  return {
    tempId,
    queueId,
    messageId,
    message, // Return message object for immediate UI update
  };
};

/**
 * Remove a message from the queue after successful send
 * @param {string} tempId - Temporary ID
 * @returns {Promise<void>}
 */
export const dequeueMessage = async (tempId) => {
  const { deleteQueueItemByTempId } = await import('../client-db/queue.db');
  await deleteQueueItemByTempId(tempId);
};

/**
 * Get all pending messages in the queue
 * @returns {Promise<Array>} Array of queue items
 */
export const getPendingMessages = async () => {
  const { getAllQueueItems } = await import('../client-db/queue.db');
  return await getAllQueueItems({ descending: false }); // Oldest first
};

/**
 * Check if there are pending messages in the queue
 * @returns {Promise<boolean>} True if queue has pending messages
 */
export const hasPendingMessages = async () => {
  const { countQueueItems } = await import('../client-db/queue.db');
  const count = await countQueueItems();
  return count > 0;
};

