/**
 * TempId Mapping Database Operations
 * 
 * CRUD operations for the tempIdMappings store in IndexedDB.
 * Mapping structure:
 * {
 *   tempId,          // Primary key - Client-generated temporary ID
 *   messageId,       // Server-assigned message ID
 *   timestamp,       // Mapping creation timestamp
 * }
 */

import { executeTransaction, STORE_NAMES } from './indexedDB.client.js';

/**
 * Add a new tempId to messageId mapping
 * @param {string} tempId - Temporary ID
 * @param {string} messageId - Server-assigned message ID
 * @returns {Promise<string>} The tempId (primary key)
 */
export const addTempIdMapping = async (tempId, messageId) => {
  const mapping = {
    tempId,
    messageId,
    timestamp: Date.now(),
  };

  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.add(mapping);
      request.onsuccess = () => {
        resolve(tempId);
      };
      request.onerror = () => {
        // If mapping already exists, update it instead
        if (request.error.name === 'ConstraintError') {
          const updateRequest = store.put(mapping);
          updateRequest.onsuccess = () => {
            resolve(tempId);
          };
          updateRequest.onerror = () => {
            reject(new Error(`Failed to update tempId mapping: ${updateRequest.error}`));
          };
        } else {
          reject(new Error(`Failed to add tempId mapping: ${request.error}`));
        }
      };
    });
  });
};

/**
 * Get a mapping by tempId
 * @param {string} tempId - Temporary ID
 * @returns {Promise<Object|null>} Mapping object or null if not found
 */
export const getMappingByTempId = async (tempId) => {
  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(tempId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get mapping by tempId: ${request.error}`));
      };
    });
  });
};

/**
 * Get a mapping by messageId
 * @param {string} messageId - Server-assigned message ID
 * @returns {Promise<Object|null>} Mapping object or null if not found
 */
export const getMappingByMessageId = async (messageId) => {
  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('messageId');
      const request = index.get(messageId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get mapping by messageId: ${request.error}`));
      };
    });
  });
};

/**
 * Get the messageId for a given tempId
 * @param {string} tempId - Temporary ID
 * @returns {Promise<string|null>} Message ID or null if not found
 */
export const getMessageIdByTempId = async (tempId) => {
  const mapping = await getMappingByTempId(tempId);
  return mapping ? mapping.messageId : null;
};

/**
 * Get the tempId for a given messageId
 * @param {string} messageId - Server-assigned message ID
 * @returns {Promise<string|null>} Temporary ID or null if not found
 */
export const getTempIdByMessageId = async (messageId) => {
  const mapping = await getMappingByMessageId(messageId);
  return mapping ? mapping.tempId : null;
};

/**
 * Update a mapping (useful if messageId changes)
 * @param {string} tempId - Temporary ID
 * @param {string} messageId - New server-assigned message ID
 * @returns {Promise<void>}
 */
export const updateMapping = async (tempId, messageId) => {
  const mapping = await getMappingByTempId(tempId);
  if (!mapping) {
    // If mapping doesn't exist, create it
    return await addTempIdMapping(tempId, messageId);
  }

  const updatedMapping = {
    ...mapping,
    messageId,
    timestamp: Date.now(),
  };

  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.put(updatedMapping);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to update mapping: ${request.error}`));
      };
    });
  });
};

/**
 * Delete a mapping by tempId
 * @param {string} tempId - Temporary ID
 * @returns {Promise<void>}
 */
export const deleteMapping = async (tempId) => {
  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(tempId);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to delete mapping: ${request.error}`));
      };
    });
  });
};

/**
 * Delete a mapping by messageId
 * @param {string} messageId - Server-assigned message ID
 * @returns {Promise<void>}
 */
export const deleteMappingByMessageId = async (messageId) => {
  const mapping = await getMappingByMessageId(messageId);
  if (!mapping) {
    return; // Already deleted or doesn't exist
  }
  return await deleteMapping(mapping.tempId);
};

/**
 * Get all mappings
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of mappings to return
 * @param {number} options.offset - Number of mappings to skip
 * @param {boolean} options.descending - Sort by timestamp descending
 * @returns {Promise<Array>} Array of mapping objects
 */
export const getAllMappings = async (options = {}) => {
  const { limit, offset = 0, descending = true } = options;

  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        let mappings = request.result || [];
        
        // Sort by timestamp
        mappings.sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return descending ? timeB - timeA : timeA - timeB;
        });

        // Apply offset and limit
        if (offset > 0) {
          mappings = mappings.slice(offset);
        }
        if (limit && limit > 0) {
          mappings = mappings.slice(0, limit);
        }

        resolve(mappings);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get all mappings: ${request.error}`));
      };
    });
  });
};

/**
 * Batch add multiple mappings
 * @param {Array<Object>} mappings - Array of { tempId, messageId } objects
 * @returns {Promise<Array<string>>} Array of tempIds that were added/updated
 */
export const addMappingsBatch = async (mappings) => {
  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const results = [];
      let completed = 0;
      let hasError = false;

      if (mappings.length === 0) {
        resolve(results);
        return;
      }

      mappings.forEach(({ tempId, messageId }) => {
        const mapping = {
          tempId,
          messageId,
          timestamp: Date.now(),
        };

        const request = store.put(mapping); // Use put to handle both add and update
        request.onsuccess = () => {
          results.push(tempId);
          completed++;
          if (completed === mappings.length && !hasError) {
            resolve(results);
          }
        };
        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            reject(new Error(`Failed to add mapping batch: ${request.error}`));
          }
        };
      });
    });
  });
};

/**
 * Count all mappings
 * @returns {Promise<number>} Number of mappings
 */
export const countMappings = async () => {
  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error(`Failed to count mappings: ${request.error}`));
      };
    });
  });
};

/**
 * Clear all mappings
 * @returns {Promise<void>}
 */
export const clearMappings = async () => {
  return await executeTransaction(STORE_NAMES.TEMP_ID_MAPPINGS, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to clear mappings: ${request.error}`));
      };
    });
  });
};

