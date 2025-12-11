/**
 * Outbound Queue Database Operations
 * 
 * CRUD operations for the outboundQueue store in IndexedDB.
 * Queue items structure:
 * {
 *   id,              // Auto-increment primary key
 *   tempId,          // Client-generated temporary ID
 *   senderId,        // Sender user ID
 *   receiverId,      // Receiver user ID
 *   content,         // Message content
 *   timestamp,       // Queue timestamp
 *   retryCount,      // Number of retry attempts
 * }
 */

import { executeTransaction, STORE_NAMES } from './indexedDB.client.js';

/**
 * Add a new item to the outbound queue
 * @param {Object} queueItem - Queue item object
 * @returns {Promise<number>} The auto-generated ID of the queue item
 */
export const addToQueue = async (queueItem) => {
  const queueItemWithDefaults = {
    retryCount: 0,
    timestamp: Date.now(),
    ...queueItem,
  };

  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.add(queueItemWithDefaults);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error(`Failed to add to queue: ${request.error}`));
      };
    });
  });
};

/**
 * Get a queue item by its ID
 * @param {number} id - Primary key ID
 * @returns {Promise<Object|null>} Queue item or null if not found
 */
export const getQueueItemById = async (id) => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get queue item: ${request.error}`));
      };
    });
  });
};

/**
 * Get a queue item by its tempId
 * @param {string} tempId - Temporary ID
 * @returns {Promise<Object|null>} Queue item or null if not found
 */
export const getQueueItemByTempId = async (tempId) => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('tempId');
      const request = index.get(tempId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get queue item by tempId: ${request.error}`));
      };
    });
  });
};

/**
 * Update a queue item
 * @param {number} id - Primary key ID
 * @param {Object} updates - Partial queue item object with fields to update
 * @returns {Promise<void>}
 */
export const updateQueueItem = async (id, updates) => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const queueItem = getRequest.result;
        if (!queueItem) {
          reject(new Error(`Queue item with id ${id} not found`));
          return;
        }

        const updatedItem = {
          ...queueItem,
          ...updates,
        };

        const putRequest = store.put(updatedItem);
        putRequest.onsuccess = () => {
          resolve();
        };
        putRequest.onerror = () => {
          reject(new Error(`Failed to update queue item: ${putRequest.error}`));
        };
      };
      getRequest.onerror = () => {
        reject(new Error(`Failed to get queue item for update: ${getRequest.error}`));
      };
    });
  });
};

/**
 * Update a queue item by its tempId
 * @param {string} tempId - Temporary ID
 * @param {Object} updates - Partial queue item object with fields to update
 * @returns {Promise<void>}
 */
export const updateQueueItemByTempId = async (tempId, updates) => {
  const queueItem = await getQueueItemByTempId(tempId);
  if (!queueItem) {
    throw new Error(`Queue item with tempId ${tempId} not found`);
  }
  return await updateQueueItem(queueItem.id, updates);
};

/**
 * Increment the retry count for a queue item
 * @param {number} id - Primary key ID
 * @returns {Promise<number>} New retry count
 */
export const incrementRetryCount = async (id) => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const queueItem = getRequest.result;
        if (!queueItem) {
          reject(new Error(`Queue item with id ${id} not found`));
          return;
        }

        const updatedItem = {
          ...queueItem,
          retryCount: (queueItem.retryCount || 0) + 1,
        };

        const putRequest = store.put(updatedItem);
        putRequest.onsuccess = () => {
          resolve(updatedItem.retryCount);
        };
        putRequest.onerror = () => {
          reject(new Error(`Failed to increment retry count: ${putRequest.error}`));
        };
      };
      getRequest.onerror = () => {
        reject(new Error(`Failed to get queue item: ${getRequest.error}`));
      };
    });
  });
};

/**
 * Delete a queue item by its ID
 * @param {number} id - Primary key ID
 * @returns {Promise<void>}
 */
export const deleteQueueItem = async (id) => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to delete queue item: ${request.error}`));
      };
    });
  });
};

/**
 * Delete a queue item by its tempId
 * @param {string} tempId - Temporary ID
 * @returns {Promise<void>}
 */
export const deleteQueueItemByTempId = async (tempId) => {
  const queueItem = await getQueueItemByTempId(tempId);
  if (!queueItem) {
    throw new Error(`Queue item with tempId ${tempId} not found`);
  }
  return await deleteQueueItem(queueItem.id);
};

/**
 * Get all queue items
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of items to return
 * @param {number} options.offset - Number of items to skip
 * @param {boolean} options.descending - Sort by timestamp descending (oldest first for queue)
 * @returns {Promise<Array>} Array of queue item objects
 */
export const getAllQueueItems = async (options = {}) => {
  const { limit, offset = 0, descending = false } = options;

  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        let items = request.result || [];
        
        // Sort by timestamp (oldest first by default for queue processing)
        items.sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return descending ? timeB - timeA : timeA - timeB;
        });

        // Apply offset and limit
        if (offset > 0) {
          items = items.slice(offset);
        }
        if (limit && limit > 0) {
          items = items.slice(0, limit);
        }

        resolve(items);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get all queue items: ${request.error}`));
      };
    });
  });
};

/**
 * Get queue items by sender ID
 * @param {string} senderId - Sender user ID
 * @returns {Promise<Array>} Array of queue item objects
 */
export const getQueueItemsBySender = async (senderId) => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('senderId');
      const request = index.getAll(senderId);
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get queue items by sender: ${request.error}`));
      };
    });
  });
};

/**
 * Get queue items with retry count below a threshold
 * @param {number} maxRetries - Maximum retry count
 * @returns {Promise<Array>} Array of queue item objects
 */
export const getQueueItemsByRetryCount = async (maxRetries) => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('retryCount');
      const request = index.openCursor();
      const items = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const item = cursor.value;
          if (item.retryCount <= maxRetries) {
            items.push(item);
          }
          cursor.continue();
        } else {
          resolve(items);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to get queue items by retry count: ${request.error}`));
      };
    });
  });
};

/**
 * Get the next queue item to process (oldest item with retry count below max)
 * @param {number} maxRetries - Maximum retry count
 * @returns {Promise<Object|null>} Queue item or null if none found
 */
export const getNextQueueItem = async (maxRetries = 5) => {
  const items = await getAllQueueItems({ limit: 1, descending: false });
  if (items.length === 0) {
    return null;
  }
  
  const item = items[0];
  if (item.retryCount > maxRetries) {
    return null;
  }
  
  return item;
};

/**
 * Count all queue items
 * @returns {Promise<number>} Number of queue items
 */
export const countQueueItems = async () => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error(`Failed to count queue items: ${request.error}`));
      };
    });
  });
};

/**
 * Clear all queue items
 * @returns {Promise<number>} Number of items deleted
 */
export const clearQueue = async () => {
  return await executeTransaction(STORE_NAMES.OUTBOUND_QUEUE, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to clear queue: ${request.error}`));
      };
    });
  });
};

