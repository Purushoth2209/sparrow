/**
 * Message Configuration
 * Configuration for message persistence, compression, and queue behavior
 */

const messageStates = require('../constants/messageStates');
const compressionTypes = require('../constants/compressionTypes');

module.exports = {
  // Message TTL (Time To Live) in days
  messageTTLDays: parseInt(process.env.MESSAGE_TTL_DAYS) || 7,
  
  // Compression algorithm: 'gzip' or 'brotli'
  compressionAlgorithm: process.env.COMPRESSION_ALGORITHM || compressionTypes.GZIP,
  
  // Queue retry configuration
  // Retry limit: 2 retries = 3 total attempts
  // Exponential backoff: 2^attempt * baseDelay
  // - Attempt 1: immediate (0s)
  // - Retry 1: 2^1 * 1000 = 2s
  // - Retry 2: 2^2 * 1000 = 4s
  // - Stop (no more retries)
  queueRetryLimit: 2,
  queueRetryBaseDelayMs: 1000, // Base delay for exponential backoff (1 second)
  
  // DEK rotation policy
  dekRotationMessages: parseInt(process.env.DEK_ROTATION_MESSAGES) || 1000,
  dekRotationPeriodHours: parseInt(process.env.DEK_ROTATION_PERIOD_HOURS) || 24,
  
  // BullMQ Redis URL
  bullmqRedisUrl: process.env.BULLMQ_REDIS_URL || process.env.REDIS_URL || null,
  
  // Worker configuration
  enableWorkers: process.env.ENABLE_WORKERS === 'true' || process.env.ENABLE_WORKERS === '1',
  
  // Status enum values (using constants)
  messageStatus: messageStates
};


