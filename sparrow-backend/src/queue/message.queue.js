const { Queue } = require('bullmq');
const { getBullMQConnection } = require('../config/redis');

/**
 * Message Queue
 * BullMQ queue for async message processing
 * Gracefully handles Redis connection failures
 */

let messageQueue = null;
let queueAvailable = false;

try {
  const connection = getBullMQConnection();
  const messageConfig = require('../config/message');
  
  messageQueue = new Queue('messageQueue', {
    connection,
    defaultJobOptions: {
      attempts: messageConfig.queueRetryLimit + 1, // +1 for initial attempt (total: 3 attempts)
      backoff: {
        type: 'exponential',
        delay: messageConfig.queueRetryBaseDelayMs || 1000, // Base delay: 1s, then 2s, 4s
      },
      // Retry plan: Attempt 1 (0s) → Retry 1 (2s) → Retry 2 (4s) → Stop
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep max 1000 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  });

  // Queue event handlers
  messageQueue.on('error', (error) => {
    // Only log connection errors once, not repeatedly
    if (error.code === 'ECONNREFUSED' && queueAvailable) {
      queueAvailable = false;
      console.warn('⚠️ Redis connection lost. Queue operations will be skipped. Start Redis to enable queue features.');
    } else if (error.code !== 'ECONNREFUSED') {
      console.error('❌ Message queue error:', error.message);
    }
  });

  messageQueue.on('ready', () => {
    if (!queueAvailable) {
      queueAvailable = true;
      console.log('✅ Message queue connected to Redis');
    }
  });

  // Test connection
  messageQueue.getWaitingCount().then(() => {
    queueAvailable = true;
    console.log('✅ Message queue initialized');
  }).catch(() => {
    queueAvailable = false;
    console.warn('⚠️ Redis not available. Queue features disabled. Messages will still be saved to database.');
  });
} catch (error) {
  console.warn('⚠️ Failed to initialize message queue:', error.message);
  console.warn('⚠️ Queue features disabled. Messages will still be saved to database.');
  queueAvailable = false;
}

messageQueue.on('waiting', (job) => {
  console.log(`⏳ Message job ${job.id} waiting`);
});

messageQueue.on('active', (job) => {
  console.log(`🔄 Processing message job ${job.id}`);
});

messageQueue.on('completed', (job) => {
  console.log(`✅ Message job ${job.id} completed`);
});

messageQueue.on('failed', (job, err) => {
  console.error(`❌ Message job ${job.id} failed:`, err.message);
});

/**
 * Add message job to queue
 * @param {Object} messageData - Message data
 * @returns {Promise<Job|null>} BullMQ job or null if queue unavailable
 */
async function addMessageJob(messageData) {
  if (!messageQueue || !queueAvailable) {
    // Queue not available - silently skip (message is already saved to DB)
    return null;
  }

  try {
    return await messageQueue.add('processMessage', messageData, {
      priority: messageData.priority || 0,
      jobId: messageData.messageId, // Use messageId as jobId for deduplication
    });
  } catch (error) {
    // If queue fails, message is still saved to database
    console.warn('⚠️ Failed to add message to queue (message still saved):', error.message);
    return null;
  }
}

module.exports = {
  messageQueue,
  addMessageJob
};
