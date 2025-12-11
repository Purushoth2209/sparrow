/**
 * Queue Module Index
 * 
 * Central export point for queue operations.
 */

export {
  enqueueMessage,
  dequeueMessage,
  getPendingMessages,
  hasPendingMessages,
} from './outboundQueue.service.js';

export {
  processQueue,
  startQueueProcessor,
  stopQueueProcessor,
  processQueueOnConnect,
  isQueueProcessing,
  pauseQueueProcessor,
  resumeQueueProcessor,
  isQueuePaused,
} from './queueProcessor.js';

