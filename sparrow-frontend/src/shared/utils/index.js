// Shared utility functions (compatible with React Native)

/**
 * Format timestamp to readable time
 * @param {string|Date|number} timestamp
 * @returns {string}
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';

  try {
    let date;
    
    if (typeof timestamp === 'string') {
      if (timestamp.includes(':') && !timestamp.includes('T') && !timestamp.includes('Z')) {
        return timestamp; // Already formatted
      }
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return 'Just now';
    }

    if (isNaN(date.getTime())) {
      return 'Just now';
    }

    const now = new Date();
    const diff = now - date;

    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  } catch (error) {
    console.warn('Error formatting timestamp:', error);
    return 'Just now';
  }
};

/**
 * Format message time for chat
 * @param {string|Date|number} timestamp
 * @returns {string}
 */
export const formatMessageTime = (timestamp) => {
  if (!timestamp) return '';

  try {
    let date;
    
    if (typeof timestamp === 'string') {
      if (timestamp.includes(':') && !timestamp.includes('T') && !timestamp.includes('Z')) {
        return timestamp;
      }
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return 'Just now';
    }

    if (isNaN(date.getTime())) {
      return 'Just now';
    }

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.warn('Error formatting message time:', error);
    return 'Just now';
  }
};

/**
 * Debounce function
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Generate conversation ID from two user IDs
 * @param {string} userId1
 * @param {string} userId2
 * @returns {string}
 */
export const getConversationId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_');
};

/**
 * Check if user is online (within last 5 minutes)
 * @param {number|string} lastSeen
 * @returns {boolean}
 */
export const isUserOnline = (lastSeen) => {
  if (!lastSeen) return false;
  const lastSeenTime = typeof lastSeen === 'string' ? new Date(lastSeen) : new Date(lastSeen);
  const now = new Date();
  const diff = now - lastSeenTime;
  return diff < 300000; // 5 minutes
};

