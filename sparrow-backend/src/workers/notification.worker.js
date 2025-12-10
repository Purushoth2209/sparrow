const { Worker } = require('bullmq');
const { getBullMQConnection } = require('../config/redis');
const { sendNotification } = require('../queue/processors/notification.processor');

/**
 * Notification Worker
 * Runs the notification processor loop
 */

let notificationWorker = null;

try {
  const connection = getBullMQConnection();
  
  notificationWorker = new Worker(
    'notificationQueue',
    async (job) => {
      return await sendNotification(job);
    },
    {
      connection,
      concurrency: 10, // Process up to 10 notifications concurrently
      limiter: {
        max: 200, // Max 200 jobs per duration
        duration: 1000, // Per 1 second
      },
    }
  );
  
  // Worker event handlers
  notificationWorker.on('completed', (job) => {
    console.log(`✅ Notification worker completed job ${job.id}`);
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`❌ Notification worker failed job ${job.id}:`, err.message);
  });

  notificationWorker.on('error', (err) => {
    // Only log non-connection errors (connection errors are handled by queue)
    if (err.code !== 'ECONNREFUSED') {
      console.error('❌ Notification worker error:', err);
    }
  });
} catch (error) {
  console.warn('⚠️ Failed to initialize notification worker:', error.message);
  console.warn('   Worker will not process jobs, but server will continue');
  // Create a dummy worker object to prevent errors
  notificationWorker = { close: async () => {} };
}

// Graceful shutdown
// Only exit process if running as standalone (not embedded in server)
const isStandalone = require.main === module || process.env.WORKER_STANDALONE === 'true';

if (isStandalone) {
  process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down notification worker...');
    if (notificationWorker && notificationWorker.close) {
      await notificationWorker.close();
    }
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down notification worker...');
    if (notificationWorker && notificationWorker.close) {
      await notificationWorker.close();
    }
    process.exit(0);
  });
} else {
  // Embedded mode: close worker on server shutdown but don't exit process
  // Use once() to prevent multiple handlers if workers are loaded multiple times
  process.once('SIGTERM', async () => {
    console.log('🛑 Shutting down notification worker (embedded mode)...');
    if (notificationWorker && notificationWorker.close) {
      await notificationWorker.close();
    }
  });

  process.once('SIGINT', async () => {
    console.log('🛑 Shutting down notification worker (embedded mode)...');
    if (notificationWorker && notificationWorker.close) {
      await notificationWorker.close();
    }
  });
}

module.exports = notificationWorker;
