const messageRepository = require('../../repositories/message.repository');
const deliveryService = require('../../services/message/delivery.service');

/**
 * Notification Processor
 * Worker logic for processing push notification jobs
 */

/**
 * Process notification job
 * @param {Job} job - BullMQ job
 * @returns {Promise<void>}
 */
async function sendNotification(job) {
  const { type, receiverId, senderId, messageId } = job.data;
  const attemptNumber = job.attemptsMade + 1;

  console.log(`🔔 Processing notification for ${receiverId}, type: ${type} (attempt ${attemptNumber})`);

  try {
    if (type === 'message') {
      // Get message from database
      const message = await messageRepository.findMessageById(messageId);
      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }

      // Get sender info for notification
      const User = require('../../models/User');
      const sender = await User.findOne({ profileId: senderId });
      const senderName = sender ? sender.username : 'Unknown User';
      
      // Get message preview (decrypt if needed for preview)
      let messagePreview = 'New message';
      try {
        if (message.isEncrypted) {
          // For preview, we can use a truncated version or decrypt
          // For now, use a generic preview to avoid decryption overhead
          messagePreview = `New message from ${senderName}`;
        } else {
          messagePreview = message.content ? 
            (message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content) :
            'New message';
        }
      } catch (previewError) {
        messagePreview = `New message from ${senderName}`;
      }

      // ALWAYS attempt to send push notification
      // This ensures user gets notification even if app is backgrounded
      console.log(`📱 Sending push notification to ${receiverId} for message ${messageId}`);
      
      // TODO: Integrate with actual push notification service
      // Example implementation:
      // const pushNotificationService = require('../../services/pushNotification.service');
      // await pushNotificationService.send({
      //   receiverId,
      //   title: senderName,
      //   body: messagePreview,
      //   data: { 
      //     messageId, 
      //     senderId,
      //     type: 'message'
      //   },
      //   priority: 'high'
      // });
      
      // For now, log the notification
      console.log(`📱 Push notification would be sent:`, {
        receiverId,
        senderId,
        senderName,
        messagePreview,
        messageId
      });
    }

    return { success: true, receiverId, type };
  } catch (error) {
    // Check if this is a permanent failure (invalid token, etc.)
    const isPermanentFailure = error.message.includes('invalid token') ||
                                error.message.includes('token not found') ||
                                error.message.includes('permanent');
    
    if (isPermanentFailure) {
      console.error(`❌ Permanent failure for notification:`, error.message);
      // TODO: Remove device token from database
      // await deviceTokenRepository.removeToken(receiverId, deviceToken);
      throw error; // Don't retry permanent failures
    }
    
    // Transient failure - will retry
    console.error(`⚠️ Transient error processing notification (will retry):`, error.message);
    throw error; // BullMQ will retry based on job options
  }
}

module.exports = {
  sendNotification
};
