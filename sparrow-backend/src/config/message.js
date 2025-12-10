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
  
  // Queue retry configuration (for mobile stability)
  // Workers retry message delivery with limited attempts to avoid:
  // - Infinite retries
  // - Duplicate notifications
  // - Worker overload
  // 
  // Retry Plan:
  // - Attempt 1 → immediate (0s)
  // - Retry 1 → 2 seconds
  // - Retry 2 → 5 seconds
  // - Stop (no more retries)
  //
  // Retry limit: 2 retries = 3 total attempts (fixed for mobile stability)
  queueRetryLimit: 2,
  // Exponential backoff delays in milliseconds: [0s, 2s, 5s]
  // First attempt: immediate (0s)
  // First retry: after 2s
  // Second retry: after 5s
  // Then stop (no more retries)
  queueRetryBackoffMs: [0, 2000, 5000], // Fixed: [0s, 2s, 5s] - explicit limit for mobile stability
  
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


