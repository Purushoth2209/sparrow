import { useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useChatStore } from '../../store/chat.store';
import { useConversationStore } from '../../store/conversation.store';
import { createSocketHandlers } from '../../services/socket/socket.handlers';

/**
 * Component that sets up socket event handlers and connects them to stores
 * This should be rendered once at the app level
 */
export const SocketHandlersSetup = () => {
  const { socket, isConnected } = useSocket();
  const chatStore = useChatStore();
  const conversationStore = useConversationStore();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentUserId = localStorage.getItem('profileId');
    if (!currentUserId) return;

    // Create handlers that update stores
    const handlers = {
      onMessageReceived: async (message) => {
        if (!message.senderId && !message.senderUsername) return;
        
        const messageId = message._id || message.id;
        if (!messageId) return;

        const currentUserId = localStorage.getItem('profileId');
        if (!currentUserId) return;

        // Check if message already exists in IndexedDB (to avoid duplicate notifications)
        const { getMessageByMessageId } = await import('../../client-db/message.db');
        const existing = await getMessageByMessageId(messageId);
        
        // Only trigger notification if:
        // - direction === 'incoming'
        // - status === 'sent'
        // - message does NOT exist in IndexedDB
        const shouldNotify = !existing && 
                             message.receiverId === currentUserId && 
                             (message.status === 'sent' || !message.status);

        // Save to IndexedDB first
        if (!existing) {
          const { addMessage: addMessageToDB } = await import('../../client-db/message.db');
          const sortedIds = [message.senderId, currentUserId].sort();
          const conversationId = `${sortedIds[0]}_${sortedIds[1]}`;
          
          await addMessageToDB({
            messageId,
            senderId: message.senderId,
            receiverId: currentUserId,
            conversationId,
            content: message.content,
            status: message.status || 'sent',
            direction: 'incoming', // Mark as incoming
            timestamp: message.timestamp 
              ? new Date(message.timestamp).getTime() 
              : Date.now(),
            serverTimestamp: message.serverTimestamp 
              ? new Date(message.serverTimestamp).getTime() 
              : undefined,
          });
        }

        // Add message to store
        chatStore.addMessage(message.senderId, {
          ...message,
          direction: 'incoming',
        });

        // Update conversation store with new message
        // Generate conversationId the same way as backend (sorted IDs joined with underscore)
        const sortedIds = [message.senderId, currentUserId].sort();
        const conversationId = `${sortedIds[0]}_${sortedIds[1]}`;
        
        const messagePreview = message.content 
          ? (message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content)
          : 'New message';
        
        conversationStore.updateConversation(conversationId, {
          lastMessageId: messageId,
          lastMessagePreview: messagePreview,
          lastMessageTimestamp: message.timestamp || message.serverTimestamp || new Date()
        });

        // Only increment unread count if should notify (new incoming message)
        if (shouldNotify && chatStore.activeConversationId !== message.senderId) {
          chatStore.incrementUnreadCount(message.senderId);
          conversationStore.incrementUnread(conversationId);
        }

        // Send delivery acknowledgment
        if (!message.isDeliveredOnConnect && message._id && socket.connected) {
          socket.emit('messageDelivered', {
            messageId: message._id,
            receiverId: currentUserId
          });
        }
      },

      onMessageSent: async (response) => {
        // Server should return { tempId, messageId } or message object with tempId
        let messageId;
        let tempId;
        let messageData;
        
        // Handle different response formats
        if (response.tempId && response.messageId) {
          // Explicit { tempId, messageId } format
          tempId = response.tempId;
          messageId = response.messageId;
          messageData = response.message || { _id: messageId, tempId };
        } else if (response.message) {
          // Message object format
          messageData = response.message;
          messageId = messageData._id || messageData.id;
          tempId = messageData.tempId;
        } else {
          // Fallback: treat response as message object
          messageData = response;
          messageId = response._id || response.id;
          tempId = response.tempId;
        }
        
        if (!messageId) {
          console.error('Socket messageSent event missing messageId');
          return;
        }
        
        // Update message in store (use receiverId from message or current user's conversation)
        const receiverId = messageData.receiverId || messageData.receiver?._id;
        if (receiverId) {
          chatStore.updateMessage(receiverId, tempId || messageId, {
            ...messageData,
            _id: messageId,
            id: messageId,
            messageId,
            status: 'sent'
          });
        }
        
        // If this was sent from queue (has tempId), update queue and localDB
        if (tempId) {
          try {
            const { dequeueMessage } = await import('../../queue/outboundQueue.service');
            const { updateMessageByTempId } = await import('../../client-db/message.db');
            const { updateMapping } = await import('../../client-db/tempId.db');
            
            // Update message in IndexedDB: tempId → messageId, status='sent'
            await updateMessageByTempId(tempId, {
              messageId,
              status: 'sent', // Update status from 'pending' to 'sent'
            });
            
            // Update tempId mapping
            await updateMapping(tempId, messageId);
            
            // Remove from queue
            await dequeueMessage(tempId);
          } catch (error) {
            console.error('Error updating queue after socket send:', error);
          }
        }
      },

      onMessageDelivered: (data) => {
        // Update message status to delivered
        if (data.messageId && data.receiverId) {
          chatStore.updateMessage(data.receiverId, data.messageId, {
            status: 'delivered',
            deliveredAt: data.deliveredAt || new Date()
          });
        }
      },

      onMessagesRead: async (data) => {
        // Mark all messages in conversation as read in both IndexedDB and ChatStore
        if (data.receiverId) {
          try {
            const currentUserId = localStorage.getItem('profileId');
            if (!currentUserId) return;
            
            // Calculate conversationId
            const sortedIds = [data.receiverId, currentUserId].sort();
            const conversationId = `${sortedIds[0]}_${sortedIds[1]}`;
            
            // Update all messages in conversation to 'read' in IndexedDB
            const { getMessagesByConversation, updateMessage } = await import('../../client-db/message.db');
            const messages = await getMessagesByConversation(conversationId);
            
            // Update all unread messages in this conversation
            for (const msg of messages) {
              if (msg.senderId === data.receiverId && msg.status !== 'read') {
                await updateMessage(msg.id, { status: 'read', readAt: Date.now() });
              }
            }
          } catch (error) {
            console.error('Error marking messages as read in IndexedDB:', error);
          }
          
          // Update in ChatStore
          chatStore.markMessagesAsRead(data.receiverId);
        }
      },

      onMessageStatusUpdate: async (data) => {
        // Update specific message status in both IndexedDB and ChatStore
        if (data.messageId && data.receiverId) {
          try {
            // Update in IndexedDB
            const { updateMessageByMessageId } = await import('../../client-db/message.db');
            await updateMessageByMessageId(data.messageId, {
              status: data.status,
              ...(data.deliveredAt && { deliveredAt: data.deliveredAt }),
              ...(data.readAt && { readAt: data.readAt }),
            });
          } catch (error) {
            console.error('Error updating message status in IndexedDB:', error);
          }
          
          // Update in ChatStore
          chatStore.updateMessage(data.receiverId, data.messageId, {
            status: data.status,
            ...(data.deliveredAt && { deliveredAt: data.deliveredAt }),
            ...(data.readAt && { readAt: data.readAt })
          });
        }
      },

      onFriendRequestReceived: () => {
        // Handled by friends components/hooks
      },

      onFriendRequestAccepted: () => {
        // Handled by friends components/hooks
      },

      onFriendRequestRejected: () => {
        // Handled by friends components/hooks
      },

      onFriendUnfriended: () => {
        // Handled by friends components/hooks
      },

      onFriendOnlineStatus: () => {
        // Handled by friends components/hooks
      },

      onFriendsStatusSnapshot: () => {
        // Handled by friends components/hooks
      },

      onReconnect: () => {
        const profileId = localStorage.getItem('profileId');
        if (profileId && socket.connected) {
          socket.emit('register', profileId);
        }
      },

      onDisconnect: () => {
        // Connection lost - handled by SocketContext
      },

      onConnectError: () => {
        // Connection error - handled by SocketContext
      }
    };

    // Register all handlers
    const cleanup = createSocketHandlers(socket, handlers);

    return cleanup;
  }, [socket, isConnected, chatStore, conversationStore]);

  return null; // This component doesn't render anything
};

