const { Queue } = require('bullmq');
const { getBullMQConnection } = require('../config/redis');

/**
 * Notification Queue
 * BullMQ queue for push notifications
 * Gracefully handles Redis connection failures
 */

let notificationQueue = null;
let queueAvailable = false;

try {
  const connection = getBullMQConnection();
  const messageConfig = require('../config/message');
  
  notificationQueue = new Queue('notificationQueue', {
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
        count: 1000,
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  });

  // Queue event handlers
  notificationQueue.on('error', (error) => {
    // Only log connection errors once
    if (error.code === 'ECONNREFUSED' && queueAvailable) {
      queueAvailable = false;
      console.warn('⚠️ Redis connection lost for notification queue.');
    } else if (error.code !== 'ECONNREFUSED') {
      console.error('❌ Notification queue error:', error.message);
    }
  });

  notificationQueue.on('ready', () => {
    if (!queueAvailable) {
      queueAvailable = true;
      console.log('✅ Notification queue connected to Redis');
    }
  });

  // Test connection silently
  notificationQueue.getWaitingCount().then(() => {
    queueAvailable = true;
  }).catch(() => {
    queueAvailable = false;
  });
} catch (error) {
  console.warn('⚠️ Failed to initialize notification queue:', error.message);
  queueAvailable = false;
}

notificationQueue.on('waiting', (job) => {
  console.log(`⏳ Notification job ${job.id} waiting`);
});

notificationQueue.on('active', (job) => {
  console.log(`🔄 Processing notification job ${job.id}`);
});

notificationQueue.on('completed', (job) => {
  console.log(`✅ Notification job ${job.id} completed`);
});

notificationQueue.on('failed', (job, err) => {
  console.error(`❌ Notification job ${job.id} failed:`, err.message);
});

/**
 * Add notification job to queue
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Job|null>} BullMQ job or null if queue unavailable
 */
async function addNotificationJob(notificationData) {
  if (!notificationQueue || !queueAvailable) {
    return null;
  }

  try {
    return await notificationQueue.add('sendNotification', notificationData, {
      priority: notificationData.priority || 0,
    });
  } catch (error) {
    console.warn('⚠️ Failed to add notification to queue:', error.message);
    return null;
  }
}

module.exports = {
  notificationQueue,
  addNotificationJob
};
