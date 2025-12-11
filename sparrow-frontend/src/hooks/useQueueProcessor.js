/**
 * useQueueProcessor Hook
 * 
 * Initializes and manages the queue processor lifecycle.
 * Automatically starts processing when socket connects and on app refresh.
 */

import { useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { 
  startQueueProcessor, 
  stopQueueProcessor, 
  processQueueOnConnect 
} from '../queue/queueProcessor';
import { useChatStore } from '../store/chat.store';
import { syncAndMerge } from '../services/sync.service';

/**
 * Hook to initialize and manage queue processor
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.processingInterval - Interval between queue checks (default: 5000ms)
 * @returns {Object} Queue processor state and controls
 */
export const useQueueProcessor = (options = {}) => {
  const { socket, isConnected, setQueueProcessorCallback } = useSocket();
  const { updateMessage, setMessageSendingState, mergeMessages } = useChatStore();
  const { processingInterval = 5000 } = options;

  // Callback when message is successfully sent
  // Handles server response: { tempId, messageId } or message object
  // Updates IndexedDB: tempId → messageId, status='sent'
  const handleMessageSent = useCallback(async (tempId, messageId, serverMessage) => {
    // Update message in IndexedDB FIRST
    try {
      const { updateMessageByTempId } = await import('../client-db/message.db');
      const { updateMapping } = await import('../client-db/tempId.db');
      
      // Update message in IndexedDB: tempId → messageId, status='sent'
      await updateMessageByTempId(tempId, {
        messageId,
        status: 'sent', // Update status from 'pending' to 'sent'
      });
      
      // Update tempId mapping
      await updateMapping(tempId, messageId);
    } catch (error) {
      console.error('Error updating message in IndexedDB after send:', error);
    }
    
    // Update message in UI store
    const profileId = localStorage.getItem('profileId');
    if (!profileId) return;

    // Find the conversation ID (receiverId from the message)
    const receiverId = serverMessage?.receiverId || serverMessage?.receiver?._id;
    if (!receiverId) {
      console.warn('No receiverId in server message for tempId:', tempId);
      // Still try to update by tempId - updateMessage can handle it
    }

    // Update message with server response - replace tempId with messageId
    const updateData = {
      _id: messageId,
      id: messageId,
      messageId, // Store messageId explicitly
      tempId, // Keep tempId for reference
      ...serverMessage,
      status: 'sent',
    };

    // Update message in store (updateMessage can find by tempId if receiverId not available)
    if (receiverId) {
      updateMessage(receiverId, tempId, updateData);
    } else {
      // Try to find receiverId from message data or use tempId directly
      // updateMessage will search by tempId if receiverId is not found
      updateMessage(null, tempId, updateData);
    }

    // Update sending state
    setMessageSendingState(tempId, 'sent');
  }, [updateMessage, setMessageSendingState]);

  // Start processor when component mounts
  useEffect(() => {
    // Start queue processor
    startQueueProcessor(handleMessageSent, processingInterval);
    
    // Register callback with socket context
    if (setQueueProcessorCallback) {
      setQueueProcessorCallback(handleMessageSent);
    }

    // Cleanup on unmount
    return () => {
      stopQueueProcessor();
      if (setQueueProcessorCallback) {
        setQueueProcessorCallback(null);
      }
    };
  }, [handleMessageSent, processingInterval, setQueueProcessorCallback]);

  // Process queue and sync when socket connects
  useEffect(() => {
    if (isConnected && socket) {
      // Process queue immediately on connect
      processQueueOnConnect(handleMessageSent);
      
      // Perform sync on connect/reconnect
      syncAndMerge({}, mergeMessages).catch(error => {
        console.error('Sync error on connect:', error);
      });
    }
  }, [isConnected, socket, handleMessageSent, mergeMessages]);

  // Process queue when window regains focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      if (isConnected) {
        processQueueOnConnect(handleMessageSent);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, handleMessageSent]);

  return {
    isConnected,
  };
};

