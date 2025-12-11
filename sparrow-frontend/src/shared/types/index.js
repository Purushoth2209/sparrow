// Shared TypeScript-like type definitions (for documentation and future TS migration)

/**
 * @typedef {Object} User
 * @property {string} profileId
 * @property {string} username
 * @property {string} email
 * @property {string} fullName
 * @property {string} profileImage
 */

/**
 * @typedef {Object} Message
 * @property {string} _id
 * @property {string} senderId
 * @property {string} receiverId
 * @property {string} content
 * @property {string} timestamp
 * @property {string} status - 'sending' | 'sent' | 'delivered' | 'read'
 */

/**
 * @typedef {Object} Friend
 * @property {string} profileId
 * @property {string} username
 * @property {string} fullName
 * @property {string} profileImage
 * @property {boolean} isOnline
 * @property {number} unreadMessages
 * @property {number} lastMovedAt
 */

/**
 * @typedef {Object} FriendRequest
 * @property {string} requestId
 * @property {string} fromUserId
 * @property {string} username
 * @property {string} fullName
 * @property {string} profileImage
 * @property {string} timestamp
 */

export const MessageStatus = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
};

export const FriendRequestStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

