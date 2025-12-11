/**
 * Message Database Operations
 * 
 * CRUD operations for the messages store in IndexedDB.
 * Messages structure:
 * {
 *   id?,              // Auto-increment primary key
 *   messageId?,       // Server-assigned message ID (optional for pending messages)
 *   tempId,           // Client-generated temporary ID
 *   senderId,         // Sender user ID
 *   receiverId,       // Receiver user ID
 *   conversationId?,  // Conversation ID (optional, can be derived)
 *   content,          // Message content
 *   encryptedContent?, // Encrypted content (optional)
 *   status,           // Message status (pending, sent, delivered, read, failed)
 *   timestamp,        // Message timestamp
 * }
 */

import { executeTransaction, STORE_NAMES } from './indexedDB.client.js';

/**
 * Generate a conversation ID from sender and receiver IDs
 * @param {string} senderId 
 * @param {string} receiverId 
 * @returns {string} Conversation ID
 */
const getConversationId = (senderId, receiverId) => {
  return [senderId, receiverId].sort().join('_');
};

/**
 * Add a new message to the database
 * @param {Object} message - Message object
 * @returns {Promise<number>} The auto-generated ID of the message
 */
export const addMessage = async (message) => {
  // Ensure conversationId is set
  const messageWithConversation = {
    ...message,
    conversationId: message.conversationId || getConversationId(message.senderId, message.receiverId),
  };

  return await executeTransaction(STORE_NAMES.MESSAGES, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.add(messageWithConversation);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error(`Failed to add message: ${request.error}`));
      };
    });
  });
};

/**
 * Get a message by its ID (primary key)
 * @param {number} id - Primary key ID
 * @returns {Promise<Object|null>} Message object or null if not found
 */
export const getMessageById = async (id) => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get message: ${request.error}`));
      };
    });
  });
};

/**
 * Get a message by its messageId (server-assigned ID)
 * @param {string} messageId - Server-assigned message ID
 * @returns {Promise<Object|null>} Message object or null if not found
 */
export const getMessageByMessageId = async (messageId) => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('messageId');
      const request = index.get(messageId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get message by messageId: ${request.error}`));
      };
    });
  });
};

/**
 * Get a message by its tempId
 * @param {string} tempId - Temporary ID
 * @returns {Promise<Object|null>} Message object or null if not found
 */
export const getMessageByTempId = async (tempId) => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('tempId');
      const request = index.get(tempId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get message by tempId: ${request.error}`));
      };
    });
  });
};

/**
 * Update an existing message
 * @param {number} id - Primary key ID
 * @param {Object} updates - Partial message object with fields to update
 * @returns {Promise<void>}
 */
export const updateMessage = async (id, updates) => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const message = getRequest.result;
        if (!message) {
          reject(new Error(`Message with id ${id} not found`));
          return;
        }

        // Merge updates
        const updatedMessage = {
          ...message,
          ...updates,
          // Ensure conversationId is updated if senderId or receiverId changed
          conversationId: updates.senderId || updates.receiverId
            ? getConversationId(
                updates.senderId || message.senderId,
                updates.receiverId || message.receiverId
              )
            : message.conversationId,
        };

        const putRequest = store.put(updatedMessage);
        putRequest.onsuccess = () => {
          resolve();
        };
        putRequest.onerror = () => {
          reject(new Error(`Failed to update message: ${putRequest.error}`));
        };
      };
      getRequest.onerror = () => {
        reject(new Error(`Failed to get message for update: ${getRequest.error}`));
      };
    });
  });
};

/**
 * Update a message by its messageId
 * @param {string} messageId - Server-assigned message ID
 * @param {Object} updates - Partial message object with fields to update
 * @returns {Promise<void>}
 */
export const updateMessageByMessageId = async (messageId, updates) => {
  const message = await getMessageByMessageId(messageId);
  if (!message) {
    throw new Error(`Message with messageId ${messageId} not found`);
  }
  return await updateMessage(message.id, updates);
};

/**
 * Update a message by its tempId
 * @param {string} tempId - Temporary ID
 * @param {Object} updates - Partial message object with fields to update
 * @returns {Promise<void>}
 */
export const updateMessageByTempId = async (tempId, updates) => {
  const message = await getMessageByTempId(tempId);
  if (!message) {
    throw new Error(`Message with tempId ${tempId} not found`);
  }
  return await updateMessage(message.id, updates);
};

/**
 * Delete a message by its ID
 * @param {number} id - Primary key ID
 * @returns {Promise<void>}
 */
export const deleteMessage = async (id) => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to delete message: ${request.error}`));
      };
    });
  });
};

/**
 * Get all messages for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of messages to return
 * @param {number} options.offset - Number of messages to skip
 * @param {boolean} options.descending - Sort by timestamp descending (newest first)
 * @returns {Promise<Array>} Array of message objects
 */
export const getMessagesByConversation = async (conversationId, options = {}) => {
  const { limit, offset = 0, descending = true } = options;

  return await executeTransaction(STORE_NAMES.MESSAGES, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);
      
      request.onsuccess = () => {
        let messages = request.result || [];
        
        // Sort by timestamp
        messages.sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return descending ? timeB - timeA : timeA - timeB;
        });

        // Apply offset and limit
        if (offset > 0) {
          messages = messages.slice(offset);
        }
        if (limit && limit > 0) {
          messages = messages.slice(0, limit);
        }

        resolve(messages);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get messages by conversation: ${request.error}`));
      };
    });
  });
};

/**
 * Get messages by sender ID
 * @param {string} senderId - Sender user ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of message objects
 */
export const getMessagesBySender = async (senderId, options = {}) => {
  const { limit, offset = 0, descending = true } = options;

  return await executeTransaction(STORE_NAMES.MESSAGES, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('senderId');
      const request = index.getAll(senderId);
      
      request.onsuccess = () => {
        let messages = request.result || [];
        
        // Sort by timestamp
        messages.sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return descending ? timeB - timeA : timeA - timeB;
        });

        // Apply offset and limit
        if (offset > 0) {
          messages = messages.slice(offset);
        }
        if (limit && limit > 0) {
          messages = messages.slice(0, limit);
        }

        resolve(messages);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get messages by sender: ${request.error}`));
      };
    });
  });
};

/**
 * Get messages by status
 * @param {string} status - Message status
 * @returns {Promise<Array>} Array of message objects
 */
export const getMessagesByStatus = async (status) => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('status');
      const request = index.getAll(status);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get messages by status: ${request.error}`));
      };
    });
  });
};

/**
 * Get all messages (use with caution for large datasets)
 * @returns {Promise<Array>} Array of all message objects
 */
export const getAllMessages = async () => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject(new Error(`Failed to get all messages: ${request.error}`));
      };
    });
  });
};

/**
 * Count messages in a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<number>} Number of messages
 */
export const countMessagesByConversation = async (conversationId) => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('conversationId');
      const request = index.count(conversationId);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error(`Failed to count messages: ${request.error}`));
      };
    });
  });
};

/**
 * Delete all messages for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<number>} Number of messages deleted
 */
export const deleteMessagesByConversation = async (conversationId) => {
  return await executeTransaction(STORE_NAMES.MESSAGES, 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('conversationId');
      const request = index.openCursor(conversationId);
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          resolve(count);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete messages: ${request.error}`));
      };
    });
  });
};

