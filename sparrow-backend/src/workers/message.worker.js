const { Worker } = require('bullmq');
const { getBullMQConnection } = require('../config/redis');
const { processMessage } = require('../queue/processors/message.processor');

/**
 * Message Worker
 * Runs the message processor loop
 */

let messageWorker = null;

try {
  const connection = getBullMQConnection();
  
  messageWorker = new Worker(
    'messageQueue',
    async (job) => {
      return await processMessage(job);
    },
    {
      connection,
      concurrency: 5, // Process up to 5 messages concurrently
      limiter: {
        max: 100, // Max 100 jobs per duration
        duration: 1000, // Per 1 second
      },
    }
  );
  
  // Worker event handlers
  messageWorker.on('completed', (job) => {
    console.log(`✅ Message worker completed job ${job.id}`);
  });

  messageWorker.on('failed', (job, err) => {
    console.error(`❌ Message worker failed job ${job.id}:`, err.message);
  });

  messageWorker.on('error', (err) => {
    // Only log non-connection errors (connection errors are handled by queue)
    if (err.code !== 'ECONNREFUSED') {
      console.error('❌ Message worker error:', err);
    }
  });
} catch (error) {
  console.warn('⚠️ Failed to initialize message worker:', error.message);
  console.warn('   Worker will not process jobs, but server will continue');
  // Create a dummy worker object to prevent errors
  messageWorker = { close: async () => {} };
}

// Graceful shutdown
// Only exit process if running as standalone (not embedded in server)
const isStandalone = require.main === module || process.env.WORKER_STANDALONE === 'true';

if (isStandalone) {
  process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down message worker...');
    if (messageWorker && messageWorker.close) {
      await messageWorker.close();
    }
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down message worker...');
    if (messageWorker && messageWorker.close) {
      await messageWorker.close();
    }
    process.exit(0);
  });
} else {
  // Embedded mode: close worker on server shutdown but don't exit process
  // Use once() to prevent multiple handlers if workers are loaded multiple times
  process.once('SIGTERM', async () => {
    console.log('🛑 Shutting down message worker (embedded mode)...');
    if (messageWorker && messageWorker.close) {
      await messageWorker.close();
    }
  });

  process.once('SIGINT', async () => {
    console.log('🛑 Shutting down message worker (embedded mode)...');
    if (messageWorker && messageWorker.close) {
      await messageWorker.close();
    }
  });
}

module.exports = messageWorker;
