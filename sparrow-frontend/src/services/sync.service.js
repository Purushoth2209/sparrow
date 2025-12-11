/**
 * Sync Service
 * 
 * Handles message synchronization for offline recovery.
 * Syncs messages from server and merges with local database and chat store.
 * 
 * 🎯 ARCHITECTURAL RULE 3: Sync API never pushes messages into queue
 * - This service ONLY fetches from server and saves to IndexedDB
 * - Queue is completely independent and never touched by sync
 * - Sync is for fetching message history, not for sending messages
 */

import { messagesApi } from './api/messages.api';
import { 
  getLastSyncTimestamp, 
  setLastSyncTimestamp,
  setLastMessageSync 
} from '../client-db/sync.db';
import { 
  addMessage
} from '../client-db/message.db';

/**
 * Sync messages from server
 * @param {Object} options - Sync options
 * @param {boolean} options.forceFullSync - Force full sync (ignore last timestamp)
 * @param {Function} options.onProgress - Progress callback (count, total)
 * @returns {Promise<Object>} Sync result with messages, conversations, and timestamp
 */
export const syncMessages = async (options = {}) => {
  const { forceFullSync = false, onProgress } = options;

  try {
    // Get last sync timestamp from IndexedDB
    let since = null;
    if (!forceFullSync) {
      since = await getLastSyncTimestamp();
      if (since) {
        // Convert to ISO string for API
        since = new Date(since).toISOString();
      }
    }

    // Call sync API
    const response = await messagesApi.sync(since);

    if (!response.success && !response.messages) {
      throw new Error(response.message || 'Sync failed');
    }

    const { messages = [], conversations = [], syncTimestamp } = response;
    const messageCount = messages.length;

    // Process and save messages to IndexedDB
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      try {
        const messageId = message.messageId || message._id || message.id;
        const senderId = message.senderId || message.sender?._id || message.sender;
        const receiverId = message.receiverId || message.receiver?._id || message.receiver;
        const currentUserId = localStorage.getItem('profileId');
        
        // Determine direction: incoming if receiver is current user, outgoing if sender is current user
        const direction = receiverId === currentUserId ? 'incoming' : 'outgoing';
        
        // Check if message already exists (deduplication)
        let existing = null;
        if (messageId) {
          const { getMessageByMessageId } = await import('../client-db/message.db');
          existing = await getMessageByMessageId(messageId);
        }
        
        if (existing) {
          // Message exists - merge status without triggering notifications
          const { updateMessageByMessageId } = await import('../client-db/message.db');
          
          // Preserve backend status (sent/delivered/read) - don't overwrite with 'delivered'
          const preservedStatus = message.status || existing.status;
          
          await updateMessageByMessageId(messageId, {
            status: preservedStatus, // Preserve backend status
            serverTimestamp: message.serverTimestamp 
              ? new Date(message.serverTimestamp).getTime() 
              : existing.serverTimestamp,
            // Don't change direction or other fields
          });
          
          skippedCount++;
          if (onProgress) {
            onProgress(i + 1, messageCount, 'merged');
          }
          continue;
        }

        // Prepare message for localDB - preserve backend status
        const localMessage = {
          messageId: messageId,
          senderId,
          receiverId,
          content: message.content,
          encryptedContent: message.encryptedContent, // May be undefined if already decrypted
          status: message.status || 'delivered', // Preserve backend status (sent/delivered/read)
          direction, // Mark direction: incoming or outgoing
          timestamp: message.serverTimestamp 
            ? new Date(message.serverTimestamp).getTime() 
            : (message.timestamp ? new Date(message.timestamp).getTime() : Date.now()),
          // Store server timestamp separately
          serverTimestamp: message.serverTimestamp 
            ? new Date(message.serverTimestamp).getTime() 
            : undefined,
        };

        // Save to IndexedDB
        await addMessage(localMessage);
        savedCount++;

        if (onProgress) {
          onProgress(i + 1, messageCount, 'saved');
        }
      } catch (error) {
        console.error(`Error saving message ${message.messageId || message._id}:`, error);
        errorCount++;
        if (onProgress) {
          onProgress(i + 1, messageCount, 'error');
        }
      }
    }

    // Update sync timestamp in IndexedDB
    if (syncTimestamp) {
      const timestamp = new Date(syncTimestamp).getTime();
      await setLastSyncTimestamp(timestamp);
      await setLastMessageSync(timestamp);
    } else {
      // Use current time if server didn't provide timestamp
      const now = Date.now();
      await setLastSyncTimestamp(now);
      await setLastMessageSync(now);
    }

    return {
      success: true,
      messages,
      conversations,
      syncTimestamp: syncTimestamp || new Date().toISOString(),
      stats: {
        total: messageCount,
        saved: savedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      error: error.message || 'Sync failed',
      messages: [],
      conversations: [],
    };
  }
};

/**
 * Merge synced messages into chat store
 * @param {Array} messages - Messages from sync
 * @param {Function} mergeMessages - Chat store merge function
 * @returns {void}
 * 
 * Note: Does NOT mark synced messages as unread
 * Preserves backend status (sent/delivered/read)
 */
export const mergeSyncedMessages = (messages, mergeMessages) => {
  if (!messages || messages.length === 0) return;

  // Group messages by conversation
  const messagesByConversation = {};

  messages.forEach(message => {
    // Determine conversation ID
    const senderId = message.senderId || message.sender?._id || message.sender;
    const receiverId = message.receiverId || message.receiver?._id || message.receiver;
    const currentUserId = localStorage.getItem('profileId');

    if (!senderId || !receiverId) {
      console.warn('Message missing senderId or receiverId:', message);
      return;
    }

    // Conversation ID is the other participant's ID
    const conversationId = senderId === currentUserId ? receiverId : senderId;
    
    // Determine direction
    const direction = receiverId === currentUserId ? 'incoming' : 'outgoing';

    if (!messagesByConversation[conversationId]) {
      messagesByConversation[conversationId] = [];
    }

    // Format message for chat store - preserve backend status
    const formattedMessage = {
      _id: message.messageId || message._id || message.id,
      id: message.messageId || message._id || message.id,
      senderId,
      receiverId,
      content: message.content,
      direction, // Include direction
      timestamp: message.serverTimestamp || message.timestamp,
      status: message.status || 'delivered', // Preserve backend status (sent/delivered/read)
      serverTimestamp: message.serverTimestamp,
    };

    messagesByConversation[conversationId].push(formattedMessage);
  });

  // Merge into chat store (no notifications triggered - these are synced messages)
  Object.keys(messagesByConversation).forEach(conversationId => {
    mergeMessages(conversationId, messagesByConversation[conversationId]);
  });
};

/**
 * Perform sync and merge with chat store
 * @param {Object} options - Sync options
 * @param {Function} mergeMessages - Chat store merge function
 * @returns {Promise<Object>} Sync result
 */
export const syncAndMerge = async (options = {}, mergeMessages) => {
  const result = await syncMessages(options);

  if (result.success && result.messages && mergeMessages) {
    mergeSyncedMessages(result.messages, mergeMessages);
  }

  return result;
};

/**
 * Get sync status
 * @returns {Promise<Object>} Sync status with last sync timestamp
 */
export const getSyncStatus = async () => {
  const lastSync = await getLastSyncTimestamp();
  return {
    lastSyncTimestamp: lastSync,
    lastSyncDate: lastSync ? new Date(lastSync) : null,
    isSynced: lastSync !== null,
  };
};

