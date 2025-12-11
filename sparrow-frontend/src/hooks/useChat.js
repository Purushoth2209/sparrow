import { useCallback, useEffect } from 'react';
import { useChatStore } from '../store/chat.store';
import { useSocket } from '../contexts/SocketContext';
import { messagesApi } from '../services/api/messages.api';
import { handleApiError, getErrorMessage } from '../services/error';
import { enqueueMessage } from '../queue/outboundQueue.service';
import { generateTempId } from '../shared/utils/uuid';

export const useChat = () => {
  const {
    activeConversationId,
    messages,
    unreadCounts,
    setActiveConversation,
    addMessage,
    updateMessage,
    markMessagesAsRead,
    incrementUnreadCount,
    setMessageSendingState,
    mergeMessages,
  } = useChatStore();

  const { socket } = useSocket();

  // Send message
  const sendMessage = useCallback(async (receiverId, content) => {
    if (!content.trim()) return { success: false, message: 'Message cannot be empty' };

    const profileId = localStorage.getItem('profileId');
    if (!profileId) {
      return { success: false, message: 'Not authenticated' };
    }

    // Generate UUID tempId
    const tempId = generateTempId();
    const timestamp = Date.now();
    
    // Calculate conversationId (sorted senderId_receiverId for IndexedDB)
    const sortedIds = [profileId, receiverId].sort();
    const conversationId = `${sortedIds[0]}_${sortedIds[1]}`;

    try {
      // 1. Save message to IndexedDB FIRST with direction:'outgoing', status:'pending'
      const { addMessage: addMessageToDB, getMessageByTempId } = await import('../client-db/message.db');
      const dbMessage = {
        tempId,
        senderId: profileId,
        receiverId,
        conversationId,
        content,
        status: 'pending',
        direction: 'outgoing', // Mark as outgoing message
        timestamp,
      };
      await addMessageToDB(dbMessage);

      // 2. Load message from IndexedDB and update chatStore
      const savedMessage = await getMessageByTempId(tempId);
      if (savedMessage) {
        const tempMessage = {
          _id: tempId,
          id: tempId,
          tempId,
          messageId: savedMessage.messageId,
          senderId: savedMessage.senderId,
          receiverId: savedMessage.receiverId,
          content: savedMessage.content,
          direction: savedMessage.direction,
          timestamp: new Date(savedMessage.timestamp).toISOString(),
          status: savedMessage.status,
        };
        
        // Update chatStore from IndexedDB
        addMessage(receiverId, tempMessage);
        setMessageSendingState(tempId, 'pending');
      }

      // 3. Insert into outboundQueue (after saving to IndexedDB)
      const { addToQueue } = await import('../client-db/queue.db');
      await addToQueue({
        tempId,
        senderId: profileId,
        receiverId,
        content,
        timestamp,
        retryCount: 0,
      });

      // 4. Try Socket.IO first if available
      if (socket && socket.connected) {
        socket.emit('sendMessage', {
          senderId: profileId,
          receiverId,
          content,
          tempId, // Include tempId for server to return in response
        });
        
        // Socket will handle the response via messageSent event with { tempId, messageId }
        // Queue processor will also handle it as a fallback if socket fails
        return { success: true, messageId: tempId, tempId };
      } else {
        // Socket not available - queue processor will handle it
        // Trigger queue processing if not already running
        const { processQueue } = await import('../queue/queueProcessor');
        processQueue();
        
        return { success: true, messageId: tempId, tempId };
      }
    } catch (error) {
      const appError = handleApiError(error);
      console.error('Error sending message:', error);
      
      // Update message status to error
      updateMessage(receiverId, tempId, {
        status: 'error',
        error: appError.message || 'Failed to send message',
      });
      setMessageSendingState(tempId, 'error');
      
      return { success: false, message: appError.message || 'Failed to send message' };
    }
  }, [socket, addMessage, updateMessage, setMessageSendingState]);

  // Mark messages as read
  const markAsRead = useCallback(async (conversationId, messageIds = null) => {
    const currentUserId = localStorage.getItem('profileId');
    if (!currentUserId) return;

    // Mark locally first
    markMessagesAsRead(conversationId, messageIds);

    // Notify server via socket
    if (socket && socket.connected) {
      const friendId = conversationId; // In this app, conversationId is the friend's profileId
      socket.emit('markMessagesAsRead', {
        senderId: friendId,
        receiverId: currentUserId,
      });
    }

    // Also call API if messageIds provided
    if (messageIds && messageIds.length > 0) {
      try {
        await messagesApi.markAsRead(messageIds);
      } catch (error) {
        console.error('Error marking messages as read via API:', error);
      }
    }
  }, [socket, markMessagesAsRead]);

  // Load messages from API (for sync)
  const loadMessages = useCallback(async (conversationId, limit = 50, offset = 0) => {
    try {
      const data = await messagesApi.getMessages(conversationId, limit, offset);
      
      if (data.success && data.messages) {
        mergeMessages(conversationId, data.messages);
        return { success: true, messages: data.messages };
      }
      
      return { success: false, message: 'Failed to load messages' };
    } catch (error) {
      const appError = handleApiError(error);
      return { success: false, message: appError.message };
    }
  }, [mergeMessages]);

  // Get messages for current conversation
  const getCurrentMessages = useCallback(() => {
    if (!activeConversationId) return [];
    return messages[activeConversationId] || [];
  }, [activeConversationId, messages]);

  // Get unread count for conversation
  const getUnreadCount = useCallback((conversationId) => {
    return unreadCounts[conversationId] || 0;
  }, [unreadCounts]);

  return {
    // State
    activeConversationId,
    messages,
    unreadCounts,
    getCurrentMessages,
    getUnreadCount,
    
    // Actions
    setActiveConversation,
    sendMessage,
    markAsRead,
    loadMessages,
    addMessage,
    updateMessage,
    incrementUnreadCount,
  };
};

