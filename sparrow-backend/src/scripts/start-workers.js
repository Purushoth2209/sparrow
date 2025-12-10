#!/usr/bin/env node

/**
 * Start Workers Script
 * Starts both message and notification workers
 */

const messageWorker = require('../workers/message.worker');
const notificationWorker = require('../workers/notification.worker');

console.log('🚀 Starting message and notification workers...');
console.log('📨 Message worker: Running');
console.log('🔔 Notification worker: Running');
console.log('Press Ctrl+C to stop all workers');

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down workers...');
  await Promise.all([
    messageWorker.close(),
    notificationWorker.close()
  ]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down workers...');
  await Promise.all([
    messageWorker.close(),
    notificationWorker.close()
  ]);
  process.exit(0);
});

