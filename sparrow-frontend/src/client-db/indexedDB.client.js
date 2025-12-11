/**
 * IndexedDB Client Setup
 * 
 * Manages the sparrowClientDB database and provides initialization utilities.
 * Uses vanilla IndexedDB API for maximum compatibility.
 */

const DB_NAME = 'sparrowClientDB';
const DB_VERSION = 1;

// Store names
export const STORE_NAMES = {
  MESSAGES: 'messages',
  OUTBOUND_QUEUE: 'outboundQueue',
  TEMP_ID_MAPPINGS: 'tempIdMappings',
  SYNC_STATE: 'syncState',
};

let dbInstance = null;
let dbPromise = null;

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>} Database instance
 */
export const initDB = () => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    // Check if IndexedDB is supported
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create messages store
      if (!db.objectStoreNames.contains(STORE_NAMES.MESSAGES)) {
        const messagesStore = db.createObjectStore(STORE_NAMES.MESSAGES, {
          keyPath: 'id',
          autoIncrement: true,
        });
        messagesStore.createIndex('messageId', 'messageId', { unique: false });
        messagesStore.createIndex('tempId', 'tempId', { unique: false });
        messagesStore.createIndex('senderId', 'senderId', { unique: false });
        messagesStore.createIndex('receiverId', 'receiverId', { unique: false });
        messagesStore.createIndex('conversationId', 'conversationId', { unique: false });
        messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
        messagesStore.createIndex('status', 'status', { unique: false });
      }

      // Create outboundQueue store
      if (!db.objectStoreNames.contains(STORE_NAMES.OUTBOUND_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_NAMES.OUTBOUND_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        queueStore.createIndex('tempId', 'tempId', { unique: false });
        queueStore.createIndex('senderId', 'senderId', { unique: false });
        queueStore.createIndex('receiverId', 'receiverId', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('retryCount', 'retryCount', { unique: false });
      }

      // Create tempIdMappings store
      if (!db.objectStoreNames.contains(STORE_NAMES.TEMP_ID_MAPPINGS)) {
        const mappingsStore = db.createObjectStore(STORE_NAMES.TEMP_ID_MAPPINGS, {
          keyPath: 'tempId',
        });
        mappingsStore.createIndex('messageId', 'messageId', { unique: true });
        mappingsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Create syncState store
      if (!db.objectStoreNames.contains(STORE_NAMES.SYNC_STATE)) {
        db.createObjectStore(STORE_NAMES.SYNC_STATE, {
          keyPath: 'key',
        });
      }
    };
  });

  return dbPromise;
};

/**
 * Get the database instance (must be initialized first)
 * @returns {Promise<IDBDatabase>} Database instance
 */
export const getDB = async () => {
  if (dbInstance) {
    return dbInstance;
  }
  return await initDB();
};

/**
 * Close the database connection
 * @returns {Promise<void>}
 */
export const closeDB = async () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
};

/**
 * Delete the entire database (useful for testing or reset)
 * @returns {Promise<void>}
 */
export const deleteDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      dbInstance = null;
      dbPromise = null;
      resolve();
    };
    request.onerror = () => {
      reject(new Error(`Failed to delete database: ${request.error}`));
    };
  });
};

/**
 * Helper function to execute a transaction
 * @param {string} storeName - Name of the object store
 * @param {string} mode - Transaction mode ('readonly' | 'readwrite')
 * @param {Function} callback - Function to execute with the transaction
 * @returns {Promise<any>} Result of the callback
 */
export const executeTransaction = async (storeName, mode, callback) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], mode);
    const store = transaction.objectStore(storeName);

    transaction.onerror = () => {
      reject(new Error(`Transaction failed: ${transaction.error}`));
    };

    transaction.oncomplete = () => {
      // Transaction completed successfully
    };

    try {
      const result = callback(store, transaction);
      if (result instanceof Promise) {
        result.then(resolve).catch(reject);
      } else {
        resolve(result);
      }
    } catch (error) {
      reject(error);
    }
  });
};

// Initialize database on module load
if (typeof window !== 'undefined') {
  initDB().catch((error) => {
    console.error('Failed to initialize IndexedDB:', error);
  });
}

