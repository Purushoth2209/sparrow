/**
 * Sync State Database Operations
 * 
 * Operations for the syncState store in IndexedDB.
 * Sync state structure:
 * {
 *   key,              // Primary key - State identifier (e.g., 'lastSyncTimestamp')
 *   value,             // State value (can be any serializable type)
 *   timestamp,         // Last update timestamp
 * }
 */

import { executeTransaction, STORE_NAMES } from './indexedDB.client.js';

// Common sync state keys
export const SYNC_KEYS = {
  LAST_SYNC_TIMESTAMP: 'lastSyncTimestamp',
  LAST_MESSAGE_SYNC: 'lastMessageSync',
  SYNC_IN_PROGRESS: 'syncInProgress',
  LAST_SYNC_ERROR: 'lastSyncError',
};

/**
 * Set a sync state value
 * @param {string} key - State key
 * @param {any} value - State value (will be serialized)
 * @returns {Promise<void>}
 */
export const setSyncState = async (key, value) => {
  const state = {
    key,
    value,
    timestamp: Date.now(),
  };

  return await executeTransaction(STORE_NAMES.SYNC_STATE, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.put(state);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to set sync state: ${request.error}`));
      };
    });
  });
};

/**
 * Get a sync state value
 * @param {string} key - State key
 * @returns {Promise<any|null>} State value or null if not found
 */
export const getSyncState = async (key) => {
  return await executeTransaction(STORE_NAMES.SYNC_STATE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get sync state: ${request.error}`));
      };
    });
  });
};

/**
 * Get sync state with metadata (includes timestamp)
 * @param {string} key - State key
 * @returns {Promise<Object|null>} State object with value and timestamp, or null if not found
 */
export const getSyncStateWithMetadata = async (key) => {
  return await executeTransaction(STORE_NAMES.SYNC_STATE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get sync state: ${request.error}`));
      };
    });
  });
};

/**
 * Get the last sync timestamp
 * @returns {Promise<number|null>} Timestamp or null if not set
 */
export const getLastSyncTimestamp = async () => {
  return await getSyncState(SYNC_KEYS.LAST_SYNC_TIMESTAMP);
};

/**
 * Set the last sync timestamp
 * @param {number} timestamp - Timestamp (defaults to current time)
 * @returns {Promise<void>}
 */
export const setLastSyncTimestamp = async (timestamp = Date.now()) => {
  return await setSyncState(SYNC_KEYS.LAST_SYNC_TIMESTAMP, timestamp);
};

/**
 * Get the last message sync timestamp
 * @returns {Promise<number|null>} Timestamp or null if not set
 */
export const getLastMessageSync = async () => {
  return await getSyncState(SYNC_KEYS.LAST_MESSAGE_SYNC);
};

/**
 * Set the last message sync timestamp
 * @param {number} timestamp - Timestamp (defaults to current time)
 * @returns {Promise<void>}
 */
export const setLastMessageSync = async (timestamp = Date.now()) => {
  return await setSyncState(SYNC_KEYS.LAST_MESSAGE_SYNC, timestamp);
};

/**
 * Check if sync is in progress
 * @returns {Promise<boolean>} True if sync is in progress
 */
export const isSyncInProgress = async () => {
  const value = await getSyncState(SYNC_KEYS.SYNC_IN_PROGRESS);
  return value === true;
};

/**
 * Set sync in progress flag
 * @param {boolean} inProgress - Whether sync is in progress
 * @returns {Promise<void>}
 */
export const setSyncInProgress = async (inProgress) => {
  return await setSyncState(SYNC_KEYS.SYNC_IN_PROGRESS, inProgress);
};

/**
 * Get the last sync error
 * @returns {Promise<Object|null>} Error object or null if no error
 */
export const getLastSyncError = async () => {
  return await getSyncState(SYNC_KEYS.LAST_SYNC_ERROR);
};

/**
 * Set the last sync error
 * @param {Object|null} error - Error object or null to clear
 * @returns {Promise<void>}
 */
export const setLastSyncError = async (error) => {
  return await setSyncState(SYNC_KEYS.LAST_SYNC_ERROR, error);
};

/**
 * Delete a sync state entry
 * @param {string} key - State key
 * @returns {Promise<void>}
 */
export const deleteSyncState = async (key) => {
  return await executeTransaction(STORE_NAMES.SYNC_STATE, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to delete sync state: ${request.error}`));
      };
    });
  });
};

/**
 * Get all sync states
 * @returns {Promise<Array>} Array of all sync state objects
 */
export const getAllSyncStates = async () => {
  return await executeTransaction(STORE_NAMES.SYNC_STATE, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get all sync states: ${request.error}`));
      };
    });
  });
};

/**
 * Clear all sync states
 * @returns {Promise<void>}
 */
export const clearSyncStates = async () => {
  return await executeTransaction(STORE_NAMES.SYNC_STATE, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to clear sync states: ${request.error}`));
      };
    });
  });
};

/**
 * Reset sync state (clears all sync-related states)
 * @returns {Promise<void>}
 */
export const resetSyncState = async () => {
  const keysToDelete = Object.values(SYNC_KEYS);
  const deletePromises = keysToDelete.map(key => deleteSyncState(key));
  await Promise.all(deletePromises);
};

