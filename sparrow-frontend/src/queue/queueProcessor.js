/**
 * Queue Processor
 * 
 * Automatically processes the outbound queue when online.
 * Handles retries with exponential backoff and updates tempId to messageId.
 */

import { 
  getNextQueueItem, 
  incrementRetryCount, 
  deleteQueueItem,
  getQueueItemByTempId 
} from '../client-db/queue.db';
import { 
  updateMessageByTempId, 
  getMessageByTempId 
} from '../client-db/message.db';
import { 
  updateMapping, 
  deleteMapping 
} from '../client-db/tempId.db';
import { messagesApi } from '../services/api/messages.api';

// Exponential backoff delays (in milliseconds)
const RETRY_DELAYS = [1000, 2000, 5000, 10000]; // 1s -> 2s -> 5s -> 10s
const MAX_RETRIES = 5;

// Processing state
let isProcessing = false;
let isPaused = false;
let processingInterval = null;
let processingTimeout = null;

/**
 * Calculate delay for retry attempt
 * @param {number} retryCount - Current retry count
 * @returns {number} Delay in milliseconds
 */
const getRetryDelay = (retryCount) => {
  if (retryCount >= RETRY_DELAYS.length) {
    return RETRY_DELAYS[RETRY_DELAYS.length - 1]; // Use max delay after all attempts
  }
  return RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
};

/**
 * Process a single queue item
 * @param {Object} queueItem - Queue item to process
 * @param {Function} onMessageSent - Callback when message is successfully sent (tempId, messageId)
 * @returns {Promise<boolean>} True if processed successfully, false if should retry
 */
const processQueueItem = async (queueItem, onMessageSent) => {
  const { tempId, senderId, receiverId, content, retryCount } = queueItem;

  try {
    // Check if message was already sent via socket (has messageId in localDB)
    const existingMessage = await getMessageByTempId(tempId);
    if (existingMessage && existingMessage.messageId) {
      // Message already sent, remove from queue
      await deleteQueueItem(queueItem.id);
      return true;
    }

    // Send message via REST API
    // Include tempId in request so server can return it in response
    const response = await messagesApi.sendMessage(receiverId, content, tempId);

    if (response.success) {
      // Server should return { tempId, messageId } or { message: { _id, tempId } }
      let messageId;
      let responseTempId = tempId; // Default to our tempId
      
      if (response.tempId && response.messageId) {
        // Server returned explicit { tempId, messageId }
        messageId = response.messageId;
        responseTempId = response.tempId;
      } else if (response.message) {
        // Server returned message object
        messageId = response.message._id || response.message.id;
        responseTempId = response.message.tempId || responseTempId;
      } else {
        throw new Error('Server response missing messageId');
      }

      // Verify tempId matches (security check)
      if (responseTempId !== tempId) {
        console.warn(`TempId mismatch: expected ${tempId}, got ${responseTempId}`);
      }

      // Update message in IndexedDB: tempId → messageId, status='sent'
      await updateMessageByTempId(tempId, {
        messageId,
        status: 'sent', // Update status from 'pending' to 'sent'
      });

      // Update tempId mapping
      await updateMapping(tempId, messageId);

      // Remove from queue
      await deleteQueueItem(queueItem.id);

      // Notify callback for UI update
      if (onMessageSent) {
        onMessageSent(tempId, messageId, response.message || { _id: messageId, tempId });
      }

      return true; // Success
    } else {
      throw new Error('Server returned unsuccessful response');
    }
  } catch (error) {
    console.error(`Failed to send message ${tempId}:`, error);

    // Check if we should retry
    if (retryCount < MAX_RETRIES) {
      // Increment retry count
      await incrementRetryCount(queueItem.id);

      // Update message status to indicate retry
      try {
        await updateMessageByTempId(tempId, {
          status: 'pending', // Will retry
        });
      } catch (updateError) {
        console.error('Failed to update message status:', updateError);
      }

      // Schedule retry with exponential backoff
      const delay = getRetryDelay(retryCount);
      setTimeout(() => {
        processQueue(); // Retry processing
      }, delay);

      return false; // Will retry
    } else {
      // Max retries exceeded - mark as failed
      console.error(`Message ${tempId} failed after ${MAX_RETRIES} retries`);

      try {
        await updateMessageByTempId(tempId, {
          status: 'failed',
          error: error.message || 'Failed to send message after multiple retries',
        });

        // Remove from queue (but keep in messages store for user to see)
        await deleteQueueItem(queueItem.id);
      } catch (updateError) {
        console.error('Failed to update failed message:', updateError);
      }

      return true; // Processed (failed, but no more retries)
    }
  }
};

/**
 * Process the next item in the queue
 * @param {Function} onMessageSent - Callback when message is successfully sent
 * @returns {Promise<boolean>} True if there are more items to process
 */
const processNextItem = async (onMessageSent) => {
  try {
    const queueItem = await getNextQueueItem(MAX_RETRIES);

    if (!queueItem) {
      return false; // No more items
    }

    // Check if this item has exceeded max retries
    if (queueItem.retryCount >= MAX_RETRIES) {
      // Mark as failed and remove from queue
      try {
        await updateMessageByTempId(queueItem.tempId, {
          status: 'failed',
          error: 'Failed to send message after multiple retries',
        });
        await deleteQueueItem(queueItem.id);
      } catch (error) {
        console.error('Failed to mark message as failed:', error);
      }
      return true; // Continue processing other items
    }

    // Process this item
    await processQueueItem(queueItem, onMessageSent);

    return true; // Continue processing
  } catch (error) {
    console.error('Error processing queue item:', error);
    return true; // Continue processing despite error
  }
};

/**
 * Process the entire queue
 * @param {Function} onMessageSent - Callback when message is successfully sent (tempId, messageId, message)
 * @returns {Promise<void>}
 */
export const processQueue = async (onMessageSent) => {
  if (isProcessing || isPaused) {
    return; // Already processing or paused
  }

  isProcessing = true;

  try {
    // Process items one at a time
    let hasMore = true;
    while (hasMore) {
      hasMore = await processNextItem(onMessageSent);
      
      // Small delay between items to avoid overwhelming the server
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error('Error processing queue:', error);
  } finally {
    isProcessing = false;
  }
};

/**
 * Start automatic queue processing
 * Processes queue periodically and on network events
 * @param {Function} onMessageSent - Callback when message is successfully sent
 * @param {number} interval - Processing interval in milliseconds (default: 5000ms)
 */
export const startQueueProcessor = (onMessageSent, interval = 5000) => {
  // Stop any existing processor
  stopQueueProcessor();

  // Process immediately
  processQueue(onMessageSent);

  // Process periodically
  processingInterval = setInterval(() => {
    if (!isProcessing) {
      processQueue(onMessageSent);
    }
  }, interval);

  // Listen for online event
  const handleOnline = () => {
    processQueue(onMessageSent);
  };

  window.addEventListener('online', handleOnline);

  // Store cleanup function
  stopQueueProcessor.cleanup = () => {
    window.removeEventListener('online', handleOnline);
  };
};

/**
 * Stop automatic queue processing
 */
export const stopQueueProcessor = () => {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }

  if (processingTimeout) {
    clearTimeout(processingTimeout);
    processingTimeout = null;
  }

  if (stopQueueProcessor.cleanup) {
    stopQueueProcessor.cleanup();
    stopQueueProcessor.cleanup = null;
  }
};

/**
 * Process queue when socket connects
 * @param {Function} onMessageSent - Callback when message is successfully sent
 */
export const processQueueOnConnect = (onMessageSent) => {
  // Process immediately when connection is established
  processQueue(onMessageSent);
};

/**
 * Check if queue processor is currently processing
 * @returns {boolean} True if processing
 */
export const isQueueProcessing = () => {
  return isProcessing;
};

/**
 * Pause queue processing (e.g., when offline)
 * @returns {void}
 */
export const pauseQueueProcessor = () => {
  isPaused = true;
  console.log('Queue processor paused');
};

/**
 * Resume queue processing (e.g., when back online)
 * @param {Function} onMessageSent - Callback when message is successfully sent
 * @returns {void}
 */
export const resumeQueueProcessor = (onMessageSent) => {
  isPaused = false;
  console.log('Queue processor resumed');
  // Process queue immediately when resumed
  if (!isProcessing) {
    processQueue(onMessageSent);
  }
};

/**
 * Check if queue processor is paused
 * @returns {boolean} True if paused
 */
export const isQueuePaused = () => {
  return isPaused;
};

