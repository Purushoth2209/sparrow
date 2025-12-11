import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ChatContext = createContext();

export const useChatStore = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatStore must be used within ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  // Active conversation
  const [activeConversationId, setActiveConversationId] = useState(null);
  
  // Messages organized by conversationId
  const [messages, setMessages] = useState({}); // { [conversationId]: [messages] }
  
  // Unread counters per conversation
  const [unreadCounts, setUnreadCounts] = useState({}); // { [conversationId]: count }
  
  // Message sending state
  const [sendingStates, setSendingStates] = useState({}); // { [messageId]: 'sending' | 'sent' | 'delivered' | 'read' }
  
  // UI state for persistence
  const [uiState, setUiState] = useState(() => {
    try {
      const saved = localStorage.getItem('sparrow_ui_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          unreadCounts: parsed.unreadCounts || {},
          lastMovedAt: parsed.lastMovedAt || {},
          readMessageIds: new Set(parsed.readMessageIds || []),
        };
      }
    } catch (error) {
      console.warn('Failed to load UI state:', error);
    }
    return {
      unreadCounts: {},
      lastMovedAt: {},
      readMessageIds: new Set(),
    };
  });

  // Persist UI state to localStorage
  useEffect(() => {
    try {
      const limitedReadIds = Array.from(uiState.readMessageIds).slice(-1000);
      const serializableState = {
        ...uiState,
        readMessageIds: limitedReadIds,
      };
      localStorage.setItem('sparrow_ui_state', JSON.stringify(serializableState));
    } catch (error) {
      console.warn('Failed to save UI state:', error);
    }
  }, [uiState]);

  // ARCHITECTURAL RULE 1: Local DB is always the source of truth for UI
  // Load messages from IndexedDB on app initialization/reload BEFORE syncing
  useEffect(() => {
    const loadAllMessagesFromDB = async () => {
      try {
        const { getAllMessages } = await import('../client-db/message.db');
        const { getMessageIdByTempId } = await import('../client-db/tempId.db');
        const currentUserId = localStorage.getItem('profileId');
        
        if (!currentUserId) {
          return; // Not authenticated yet
        }

        // Get all messages from IndexedDB FIRST (before any sync)
        const allMessages = await getAllMessages();
        
        // Group messages by conversation
        const messagesByConversation = {};
        
        for (const dbMsg of allMessages) {
          // Resolve tempId → messageId if needed
          let messageId = dbMsg.messageId;
          if (dbMsg.tempId && !messageId) {
            const mappedId = await getMessageIdByTempId(dbMsg.tempId);
            if (mappedId) {
              messageId = mappedId;
            }
          }
          
          // Determine conversation ID (friend's profileId)
          const senderId = dbMsg.senderId;
          const receiverId = dbMsg.receiverId;
          const conversationId = senderId === currentUserId ? receiverId : senderId;
          
          if (!conversationId) continue;
          
          if (!messagesByConversation[conversationId]) {
            messagesByConversation[conversationId] = [];
          }
          
          // Format message for UI
          const formattedMessage = {
            _id: messageId || dbMsg.tempId || dbMsg.id,
            id: messageId || dbMsg.tempId || dbMsg.id,
            tempId: dbMsg.tempId,
            messageId: messageId,
            senderId: senderId,
            receiverId: receiverId,
            content: dbMsg.content,
            encryptedContent: dbMsg.encryptedContent,
            direction: dbMsg.direction || (senderId === currentUserId ? 'outgoing' : 'incoming'),
            status: dbMsg.status || 'pending',
            timestamp: dbMsg.timestamp 
              ? new Date(dbMsg.timestamp).toISOString() 
              : new Date().toISOString(),
            serverTimestamp: dbMsg.serverTimestamp 
              ? new Date(dbMsg.serverTimestamp).toISOString() 
              : undefined,
          };
          
          messagesByConversation[conversationId].push(formattedMessage);
        }
        
        // Sort messages chronologically and set in store
        Object.keys(messagesByConversation).forEach(convId => {
          messagesByConversation[convId].sort((a, b) => {
            const aTime = new Date(a.timestamp || a.serverTimestamp || 0).getTime();
            const bTime = new Date(b.timestamp || b.serverTimestamp || 0).getTime();
            return aTime - bTime;
          });
        });
        
        // Set all messages in store (Local DB is source of truth)
        setMessages(messagesByConversation);
        
        console.log(`Loaded ${allMessages.length} messages from IndexedDB on app initialization`);
      } catch (error) {
        console.error('Error loading messages from IndexedDB on initialization:', error);
      }
    };
    
    loadAllMessagesFromDB();
  }, []); // Run once on mount

  // Set active conversation
  const setActiveConversation = useCallback((conversationId) => {
    setActiveConversationId(conversationId);
    
    // Reset unread count for this conversation
    if (conversationId) {
      setUnreadCounts(prev => ({
        ...prev,
        [conversationId]: 0,
      }));
      
      setUiState(prev => ({
        ...prev,
        unreadCounts: {
          ...prev.unreadCounts,
          [conversationId]: 0,
        },
      }));
    }
  }, []);

  // Increment unread count (defined before addMessage to avoid hoisting issues)
  const incrementUnreadCount = useCallback((conversationId) => {
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || 0) + 1,
    }));
    
    setUiState(prev => ({
      ...prev,
      unreadCounts: {
        ...prev.unreadCounts,
        [conversationId]: (prev.unreadCounts[conversationId] || 0) + 1,
      },
    }));
  }, []);

  // Add message to conversation
  // Only triggers notification if: direction === 'incoming' AND status === 'sent' AND message doesn't exist in IndexedDB
  const addMessage = useCallback(async (conversationId, message) => {
    // Check if message already exists in IndexedDB to avoid duplicate notifications
    let shouldNotify = false;
    
    if (message.direction === 'incoming' && message.status === 'sent') {
      try {
        const messageId = message._id || message.id || message.messageId;
        if (messageId) {
          const { getMessageByMessageId } = await import('../client-db/message.db');
          const existing = await getMessageByMessageId(messageId);
          shouldNotify = !existing; // Only notify if message doesn't exist
        } else {
          shouldNotify = true; // No messageId, assume new
        }
      } catch (error) {
        console.error('Error checking message existence:', error);
        shouldNotify = true; // On error, notify to be safe
      }
    }
    
    // Add to store
    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), message],
    }));
    
    // Only increment unread count if should notify
    if (shouldNotify && message.direction === 'incoming' && message.status === 'sent') {
      const currentUserId = localStorage.getItem('profileId');
      if (message.senderId !== currentUserId && activeConversationId !== conversationId) {
        incrementUnreadCount(conversationId);
      }
    }
  }, [activeConversationId, incrementUnreadCount]);

  // Update message in conversation
  // Can update by messageId (server ID) or tempId (client ID)
  // If conversationId is null, searches all conversations
  const updateMessage = useCallback((conversationId, messageIdOrTempId, updates) => {
    setMessages(prev => {
      // If conversationId is null, search all conversations
      if (conversationId === null || conversationId === undefined) {
        const updated = { ...prev };
        let found = false;
        
        Object.keys(updated).forEach(convId => {
          updated[convId] = updated[convId].map(msg => {
            // Match by _id, id, or tempId
            const matches = 
              msg._id === messageIdOrTempId || 
              msg.id === messageIdOrTempId || 
              msg.tempId === messageIdOrTempId;
            
            if (matches) {
              found = true;
              // If updating tempId to messageId, replace the ID fields
              const updatedMsg = { ...msg, ...updates };
              
              // If server returned messageId, replace tempId references
              if (updates.messageId && msg.tempId) {
                updatedMsg._id = updates.messageId;
                updatedMsg.id = updates.messageId;
                // Keep tempId for reference but messageId is now primary
              }
              
              return updatedMsg;
            }
            return msg;
          });
        });
        
        return found ? updated : prev;
      }
      
      // Update specific conversation
      const conversationMessages = prev[conversationId] || [];
      return {
        ...prev,
        [conversationId]: conversationMessages.map(msg => {
          // Match by _id, id, or tempId
          const matches = 
            msg._id === messageIdOrTempId || 
            msg.id === messageIdOrTempId || 
            msg.tempId === messageIdOrTempId;
          
          if (matches) {
            // If updating tempId to messageId, replace the ID fields
            const updated = { ...msg, ...updates };
            
            // If server returned messageId, replace tempId references
            if (updates.messageId && msg.tempId) {
              updated._id = updates.messageId;
              updated.id = updates.messageId;
              // Keep tempId for reference but messageId is now primary
            }
            
            return updated;
          }
          return msg;
        }),
      };
    });
  }, []);

  // Mark messages as read
  // Also updates IndexedDB
  const markMessagesAsRead = useCallback(async (conversationId, messageIds = null) => {
    const currentUserId = localStorage.getItem('profileId');
    
    // Update in IndexedDB
    try {
      const { getMessagesByConversation, updateMessage } = await import('../client-db/message.db');
      const sortedIds = [conversationId, currentUserId].sort();
      const dbConversationId = `${sortedIds[0]}_${sortedIds[1]}`;
      
      const messages = await getMessagesByConversation(dbConversationId);
      
      // Update all unread messages in this conversation
      for (const msg of messages) {
        if (msg.senderId === conversationId && msg.status !== 'read') {
          // If specific messageIds provided, only mark those
          if (messageIds && !messageIds.includes(msg.messageId || msg.tempId)) {
            continue;
          }
          
          await updateMessage(msg.id, { 
            status: 'read', 
            readAt: Date.now() 
          });
        }
      }
    } catch (error) {
      console.error('Error marking messages as read in IndexedDB:', error);
    }
    
    // Update in ChatStore
    setMessages(prev => {
      const conversationMessages = prev[conversationId] || [];
      return {
        ...prev,
        [conversationId]: conversationMessages.map(msg => {
          // If specific messageIds provided, only mark those
          if (messageIds && !messageIds.includes(msg._id || msg.id)) {
            return msg;
          }
          
          // Mark as read if from this conversation and not from current user
          if (msg.senderId !== currentUserId && msg.status !== 'read') {
            return { ...msg, status: 'read', readAt: new Date() };
          }
          return msg;
        }),
      };
    });

    // Update read message IDs
    if (messageIds) {
      setUiState(prev => ({
        ...prev,
        readMessageIds: new Set([...prev.readMessageIds, ...messageIds]),
      }));
    }
  }, []);


  // Set message sending state
  const setMessageSendingState = useCallback((messageId, state) => {
    setSendingStates(prev => ({
      ...prev,
      [messageId]: state,
    }));
  }, []);

  // Load messages from IndexedDB for a conversation
  const loadMessagesFromDB = useCallback(async (conversationId) => {
    try {
      const { getMessagesByConversation } = await import('../client-db/message.db');
      const { getMessageIdByTempId } = await import('../client-db/tempId.db');
      
      // In this app, conversationId is the friend's profileId
      // But IndexedDB stores conversationId as sorted senderId_receiverId
      // We need to search by both senderId and receiverId
      const currentUserId = localStorage.getItem('profileId');
      if (!currentUserId) {
        return [];
      }
      
      // Calculate the IndexedDB conversationId (sorted IDs)
      const sortedIds = [currentUserId, conversationId].sort();
      const dbConversationId = `${sortedIds[0]}_${sortedIds[1]}`;
      
      // Get messages from IndexedDB
      const dbMessages = await getMessagesByConversation(dbConversationId, {
        limit: 100, // Load last 100 messages from DB
        descending: true,
      });
      
      // Convert DB messages to UI format
      const formattedMessages = await Promise.all(
        dbMessages.map(async (dbMsg) => {
          // If message has tempId but no messageId, check mapping
          let messageId = dbMsg.messageId;
          if (dbMsg.tempId && !messageId) {
            const mappedId = await getMessageIdByTempId(dbMsg.tempId);
            if (mappedId) {
              messageId = mappedId;
            }
          }
          
          return {
            _id: messageId || dbMsg.tempId || dbMsg.id,
            id: messageId || dbMsg.tempId || dbMsg.id,
            tempId: dbMsg.tempId,
            messageId: messageId,
            senderId: dbMsg.senderId,
            receiverId: dbMsg.receiverId,
            content: dbMsg.content,
            encryptedContent: dbMsg.encryptedContent,
            status: dbMsg.status || 'pending',
            timestamp: dbMsg.timestamp 
              ? new Date(dbMsg.timestamp).toISOString() 
              : new Date().toISOString(),
            serverTimestamp: dbMsg.serverTimestamp 
              ? new Date(dbMsg.serverTimestamp).toISOString() 
              : undefined,
          };
        })
      );
      
      // Set messages in store (Local DB is source of truth)
      if (formattedMessages.length > 0) {
        setMessages(prev => ({
          ...prev,
          [conversationId]: formattedMessages.sort((a, b) => {
            const aTime = new Date(a.timestamp || a.serverTimestamp || 0).getTime();
            const bTime = new Date(b.timestamp || b.serverTimestamp || 0).getTime();
            return aTime - bTime; // Chronological order
          }),
        }));
      }
      
      return formattedMessages;
    } catch (error) {
      console.error('Error loading messages from DB:', error);
      return [];
    }
  }, []);

  // Merge messages from API (for sync)
  // ARCHITECTURAL RULE 3: Sync API never pushes messages into queue
  // This function only merges server messages into store, never touches queue
  // Handles deduplication using messageId, tempId, and tempId→messageId mapping
  const mergeMessages = useCallback(async (conversationId, apiMessages) => {
    try {
      const { getMessageIdByTempId, getTempIdByMessageId } = await import('../client-db/tempId.db');
      
      setMessages(prev => {
        const existingMessages = prev[conversationId] || [];
        const messageMap = new Map(); // Key: messageId or tempId, Value: message
        
        // Add existing messages to map
        existingMessages.forEach(msg => {
          const id = msg.messageId || msg._id || msg.id || msg.tempId;
          if (id) {
            messageMap.set(id, msg);
            // Also index by tempId if present
            if (msg.tempId && msg.tempId !== id) {
              messageMap.set(msg.tempId, msg);
            }
          }
        });
        
        // Merge API messages (they take precedence for server state)
        apiMessages.forEach(apiMsg => {
          const messageId = apiMsg.messageId || apiMsg._id || apiMsg.id;
          const tempId = apiMsg.tempId;
          
          // Check if message already exists by messageId
          if (messageId && messageMap.has(messageId)) {
            const existing = messageMap.get(messageId);
            // Update existing message with server data (server takes precedence)
            const updated = {
              ...existing,
              ...apiMsg,
              _id: messageId,
              id: messageId,
              messageId,
              // Preserve tempId if it exists
              tempId: existing.tempId || tempId,
            };
            messageMap.set(messageId, updated);
            if (updated.tempId && updated.tempId !== messageId) {
              messageMap.set(updated.tempId, updated);
            }
            return;
          }
          
          // Check if message exists by tempId
          if (tempId && messageMap.has(tempId)) {
            const existing = messageMap.get(tempId);
            // This is a tempId that now has a messageId - replace it
            if (messageId) {
              // Remove old tempId entry
              messageMap.delete(tempId);
              // Add with messageId
              const updated = {
                ...existing,
                ...apiMsg,
                _id: messageId,
                id: messageId,
                messageId,
                tempId: existing.tempId || tempId,
              };
              messageMap.set(messageId, updated);
              if (updated.tempId && updated.tempId !== messageId) {
                messageMap.set(updated.tempId, updated);
              }
            } else {
              // No messageId yet, just update
              const updated = { ...existing, ...apiMsg };
              messageMap.set(tempId, updated);
            }
            return;
          }
          
          // New message - add it
          const newMsg = {
            ...apiMsg,
            _id: messageId || tempId,
            id: messageId || tempId,
            messageId,
            tempId,
          };
          const key = messageId || tempId;
          messageMap.set(key, newMsg);
          if (tempId && tempId !== key) {
            messageMap.set(tempId, newMsg);
          }
        });
        
        // Convert map to array and sort chronologically
        const mergedMessages = Array.from(messageMap.values());
        
        // Deduplicate by messageId (keep the one with messageId if both exist)
        const deduplicated = [];
        const seenIds = new Set();
        
        mergedMessages.forEach(msg => {
          const id = msg.messageId || msg._id || msg.id;
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            deduplicated.push(msg);
          } else if (!id && msg.tempId && !seenIds.has(msg.tempId)) {
            seenIds.add(msg.tempId);
            deduplicated.push(msg);
          }
        });
        
        return {
          ...prev,
          [conversationId]: deduplicated.sort((a, b) => {
            const aTime = new Date(a.timestamp || a.serverTimestamp || a.createdAt || 0).getTime();
            const bTime = new Date(b.timestamp || b.serverTimestamp || b.createdAt || 0).getTime();
            return aTime - bTime; // Chronological order
          }),
        };
      });
    } catch (error) {
      console.error('Error merging messages:', error);
      // Fallback to simple merge without mapping
      setMessages(prev => {
        const existingMessages = prev[conversationId] || [];
        const messageMap = new Map();
        
        existingMessages.forEach(msg => {
          const id = msg._id || msg.id;
          if (id) messageMap.set(id, msg);
        });
        
        apiMessages.forEach(msg => {
          const id = msg._id || msg.id;
          if (id) {
            messageMap.set(id, msg);
          }
        });
        
        return {
          ...prev,
          [conversationId]: Array.from(messageMap.values()).sort((a, b) => {
            const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
            const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();
            return aTime - bTime;
          }),
        };
      });
    }
  }, []);

  // Clear conversation messages
  const clearConversation = useCallback((conversationId) => {
    setMessages(prev => {
      const updated = { ...prev };
      delete updated[conversationId];
      return updated;
    });
    
    setUnreadCounts(prev => {
      const updated = { ...prev };
      delete updated[conversationId];
      return updated;
    });
  }, []);

  const value = {
    // State
    activeConversationId,
    messages,
    unreadCounts,
    sendingStates,
    uiState,
    
    // Actions
    setActiveConversation,
    addMessage,
    updateMessage,
    markMessagesAsRead,
    incrementUnreadCount,
    setMessageSendingState,
    loadMessagesFromDB,
    mergeMessages,
    clearConversation,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
