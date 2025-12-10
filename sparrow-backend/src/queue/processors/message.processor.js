const deliveryService = require('../../services/message/delivery.service');
const { addNotificationJob } = require('../notification.queue');
const messageRepository = require('../../repositories/message.repository');
const { userSockets } = require('../../socket');
const messageStates = require('../../constants/messageStates');

/**
 * Message Processor
 * Worker logic for processing message delivery jobs
 * 
 * IMPORTANT BEHAVIOR:
 * - Workers check online status ONCE per job execution
 * - Workers do NOT continuously poll or wait for user to come online
 * - If receiver is offline, notification is sent and job completes
 * - Receiver will fetch messages via GET /messages/sync?since=timestamp
 * - Workers STOP after one attempt (with retries for transient failures only)
 */

/**
 * Process message delivery job
 * @param {Job} job - BullMQ job
 * @returns {Promise<void>}
 */
async function processMessage(job) {
  const { messageId, receiverId, senderId } = job.data;
  const attemptNumber = job.attemptsMade + 1;

  console.log(`📨 Processing message ${messageId} for receiver ${receiverId} (attempt ${attemptNumber})`);

  // Check if we've exceeded retry limit
  const messageConfig = require('../../config/message');
  if (attemptNumber > messageConfig.queueRetryLimit + 1) {
    console.error(`❌ Message ${messageId} exceeded retry limit (${messageConfig.queueRetryLimit}), marking as failed`);
    throw new Error(`Message processing failed after ${attemptNumber} attempts`);
  }

  try {
    // Get message from database
    const message = await messageRepository.findMessageById(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // ⚠️ IMPORTANT: Check online status ONCE - do NOT continuously poll
    // If receiver is offline, job completes and receiver will sync via API
    const receiverSocketId = userSockets.get(receiverId);
    
    if (receiverSocketId) {
      // Receiver is online - deliver via Socket.IO immediately
      console.log(`✅ Receiver ${receiverId} is online, delivering via Socket.IO`);
      
      try {
        await deliveryService.deliverMessageToReceiver(message, receiverId);
        
        // Notify sender
        await deliveryService.notifySenderOfStatus(senderId, {
          type: 'messageStatusUpdate',
          messageId: messageId,
          status: messageStates.DELIVERED,
          deliveredAt: new Date()
        });
      } catch (deliveryError) {
        // Transient error (socket send failed) - retry with backoff
        console.error(`⚠️ Delivery error for message ${messageId}:`, deliveryError.message);
        throw deliveryError; // Will trigger retry with exponential backoff
      }
    } else {
      // Receiver is offline - ensure notification job exists and STOP
      // Notification job should already be enqueued from sendMessage(), but ensure it exists
      console.log(`📱 Receiver ${receiverId} is offline - notification will be sent, receiver will sync via API`);
      
      try {
        await addNotificationJob({
          type: 'message',
          receiverId: receiverId,
          senderId: senderId,
          messageId: messageId,
          priority: 1
        });
      } catch (notifError) {
        console.warn(`⚠️ Failed to enqueue notification job: ${notifError.message}`);
        // Don't fail the message job if notification fails
      }
      
      // ⚠️ IMPORTANT: Do NOT mark as delivered if receiver is offline
      // Message stays in 'sent' status until receiver syncs via GET /messages/sync
      // Worker job completes here - does NOT wait for user to come online
    }

    return { success: true, messageId, delivered: !!receiverSocketId };
  } catch (error) {
    // Check if this is a permanent failure
    const isPermanentFailure = error.message.includes('not found') || 
                                error.message.includes('Invalid') ||
                                error.message.includes('permanent');
    
    if (isPermanentFailure) {
      console.error(`❌ Permanent failure for message ${messageId}:`, error.message);
      throw error; // Don't retry permanent failures
    }
    
    // Transient failure - will retry with exponential backoff
    console.error(`⚠️ Transient error processing message ${messageId} (will retry):`, error.message);
    throw error; // BullMQ will retry based on job options with exponential backoff
  }
}

module.exports = {
  processMessage
};
