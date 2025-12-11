/**
 * Client Database Index
 * 
 * Central export point for all client database operations.
 */

// IndexedDB setup
export {
  initDB,
  getDB,
  closeDB,
  deleteDB,
  executeTransaction,
  STORE_NAMES,
} from './indexedDB.client.js';

// Message operations
export {
  addMessage,
  getMessageById,
  getMessageByMessageId,
  getMessageByTempId,
  updateMessage,
  updateMessageByMessageId,
  updateMessageByTempId,
  deleteMessage,
  getMessagesByConversation,
  getMessagesBySender,
  getMessagesByStatus,
  getAllMessages,
  countMessagesByConversation,
  deleteMessagesByConversation,
} from './message.db.js';

// Queue operations
export {
  addToQueue,
  getQueueItemById,
  getQueueItemByTempId,
  updateQueueItem,
  updateQueueItemByTempId,
  incrementRetryCount,
  deleteQueueItem,
  deleteQueueItemByTempId,
  getAllQueueItems,
  getQueueItemsBySender,
  getQueueItemsByRetryCount,
  getNextQueueItem,
  countQueueItems,
  clearQueue,
} from './queue.db.js';

// TempId mapping operations
export {
  addTempIdMapping,
  getMappingByTempId,
  getMappingByMessageId,
  getMessageIdByTempId,
  getTempIdByMessageId,
  updateMapping,
  deleteMapping,
  deleteMappingByMessageId,
  getAllMappings,
  addMappingsBatch,
  countMappings,
  clearMappings,
} from './tempId.db.js';

// Sync state operations
export {
  setSyncState,
  getSyncState,
  getSyncStateWithMetadata,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  getLastMessageSync,
  setLastMessageSync,
  isSyncInProgress,
  setSyncInProgress,
  getLastSyncError,
  setLastSyncError,
  deleteSyncState,
  getAllSyncStates,
  clearSyncStates,
  resetSyncState,
  SYNC_KEYS,
} from './sync.db.js';

