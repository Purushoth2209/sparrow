import React, { createContext, useContext, useState, useCallback } from 'react';
import { conversationApi } from '../services/api/conversation.api';

const ConversationContext = createContext();

export const useConversationStore = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversationStore must be used within a ConversationProvider');
  }
  return context;
};

export const ConversationProvider = ({ children }) => {
  // State
  const [conversations, setConversations] = useState([]); // Array of conversation objects
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load conversations from API
  const loadConversations = useCallback(async (options = {}) => {
    setLoading(true);
    setError('');

    try {
      const data = await conversationApi.getConversations(options);

      if (data.success && data.conversations) {
        setConversations(data.conversations);
        return { success: true, conversations: data.conversations };
      }

      return { success: false, message: data.message || 'Failed to load conversations' };
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to load conversations';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // Set active conversation
  const setActiveConversation = useCallback((conversationId) => {
    setActiveConversationId(conversationId);
    
    // Reset unread count when conversation becomes active
    if (conversationId) {
      resetUnread(conversationId);
    }
  }, []);

  // Increment unread count for a conversation
  const incrementUnread = useCallback((conversationId) => {
    setConversations(prev => prev.map(conv => {
      if (conv.conversationId === conversationId) {
        return {
          ...conv,
          unreadCount: (conv.unreadCount || 0) + 1
        };
      }
      return conv;
    }));
  }, []);

  // Reset unread count for a conversation
  const resetUnread = useCallback(async (conversationId) => {
    // Update local state immediately
    setConversations(prev => prev.map(conv => {
      if (conv.conversationId === conversationId) {
        return {
          ...conv,
          unreadCount: 0
        };
      }
      return conv;
    }));

    // Call API to reset on server
    try {
      await conversationApi.resetUnread(conversationId);
    } catch (error) {
      // Silently handle errors - local state already updated
    }
  }, []);

  // Merge conversation updates (for socket updates)
  const mergeConversationUpdates = useCallback((updates) => {
    setConversations(prev => {
      const updated = [...prev];
      
      updates.forEach(update => {
        const index = updated.findIndex(c => c.conversationId === update.conversationId);
        
        if (index !== -1) {
          // Update existing conversation
          updated[index] = {
            ...updated[index],
            ...update,
            // Preserve unreadCount if not provided in update
            unreadCount: update.unreadCount !== undefined 
              ? update.unreadCount 
              : updated[index].unreadCount
          };
        } else {
          // Add new conversation
          updated.push(update);
        }
      });

      // Sort by lastMessageTimestamp (most recent first)
      return updated.sort((a, b) => {
        const aTime = new Date(a.lastMessageTimestamp || 0).getTime();
        const bTime = new Date(b.lastMessageTimestamp || 0).getTime();
        return bTime - aTime;
      });
    });
  }, []);

  // Update a single conversation
  const updateConversation = useCallback((conversationId, updates) => {
    setConversations(prev => prev.map(conv => {
      if (conv.conversationId === conversationId) {
        return { ...conv, ...updates };
      }
      return conv;
    }));
  }, []);

  // Get conversation by ID
  const getConversation = useCallback((conversationId) => {
    return conversations.find(c => c.conversationId === conversationId);
  }, [conversations]);

  // Get unread count for a conversation
  const getUnreadCount = useCallback((conversationId) => {
    const conversation = conversations.find(c => c.conversationId === conversationId);
    return conversation?.unreadCount || 0;
  }, [conversations]);

  // Get total unread count across all conversations
  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
  }, [conversations]);

  // Delete (archive) a conversation
  const deleteConversation = useCallback(async (conversationId) => {
    try {
      const data = await conversationApi.deleteConversation(conversationId);
      
      if (data.success) {
        // Remove from local state
        setConversations(prev => prev.filter(c => c.conversationId !== conversationId));
        
        // Clear active conversation if it was deleted
        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
        }
        
        return { success: true };
      }
      
      return { success: false, message: data.message || 'Failed to delete conversation' };
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to delete conversation';
      return { success: false, message: errorMsg };
    }
  }, [activeConversationId]);

  const value = {
    // State
    conversations,
    activeConversationId,
    loading,
    error,
    
    // Actions
    loadConversations,
    setActiveConversation,
    incrementUnread,
    resetUnread,
    mergeConversationUpdates,
    updateConversation,
    getConversation,
    getUnreadCount,
    getTotalUnreadCount,
    deleteConversation,
    setError
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
};

