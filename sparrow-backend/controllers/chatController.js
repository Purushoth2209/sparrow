const Message = require('../models/Message');
const User = require('../models/User');
const { getDecryptedMessages } = require('./messageController');

/**
 * Chat Controller - Handles chat list and conversation management
 * 
 * This controller provides functionality for:
 * - Listing chats ordered by latest message
 * - Getting chat previews with last message
 * - Managing conversation metadata
 */

/**
 * Get user's chat list ordered by latest message timestamp
 * @param {string} userId - User's profile ID
 * @returns {Array} Array of chat objects with last message preview
 */
async function getChatList(userId) {
  try {
    // Get all messages for the user (both sent and received)
    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    }).sort({ timestamp: -1 });

    // Group messages by conversation (friend pair)
    const conversations = new Map();
    
    for (const message of messages) {
      // Determine the other user in the conversation
      const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;
      
      // If this is the first message with this user, create conversation entry
      if (!conversations.has(otherUserId)) {
        conversations.set(otherUserId, {
          friendId: otherUserId,
          lastMessage: null,
          lastMessageTimestamp: null,
          unreadCount: 0,
          lastMessageSender: null,
          lastMessageContent: null
        });
      }
      
      const conversation = conversations.get(otherUserId);
      
      // Update with the most recent message (since messages are sorted by timestamp desc)
      if (!conversation.lastMessage || message.timestamp > conversation.lastMessageTimestamp) {
        conversation.lastMessage = message;
        conversation.lastMessageTimestamp = message.timestamp;
        conversation.lastMessageSender = message.senderId;
        
        // Decrypt message content for preview
        try {
          if (message.isEncrypted) {
            const { decryptSingleMessage } = require('./messageController');
            const decryptedMessage = await decryptSingleMessage(message);
            conversation.lastMessageContent = decryptedMessage.content;
          } else {
            conversation.lastMessageContent = message.content;
          }
        } catch (error) {
          console.error(`❌ Failed to decrypt message for chat list:`, error);
          conversation.lastMessageContent = '[Message could not be decrypted]';
        }
      }
      
      // Count unread messages (messages sent to this user that are not read)
      if (message.receiverId === userId && message.status !== 'read') {
        conversation.unreadCount++;
      }
    }

    // Get friend information for each conversation
    const chatList = [];
    for (const [friendId, conversation] of conversations) {
      try {
        const friend = await User.findOne({ profileId: friendId });
        if (friend) {
          chatList.push({
            friendId: friendId,
            friendUsername: friend.username,
            friendDisplayName: friend.displayName || friend.username,
            friendIsOnline: friend.isOnline || false,
            friendLastSeen: friend.lastSeen,
            lastMessage: {
              content: conversation.lastMessageContent,
              senderId: conversation.lastMessageSender,
              timestamp: conversation.lastMessageTimestamp,
              status: conversation.lastMessage?.status || 'sent',
              isFromCurrentUser: conversation.lastMessageSender === userId
            },
            unreadCount: conversation.unreadCount,
            lastActivity: conversation.lastMessageTimestamp
          });
        }
      } catch (error) {
        console.error(`❌ Failed to get friend info for ${friendId}:`, error);
      }
    }

    // Sort by last activity timestamp (most recent first)
    chatList.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    return chatList;
  } catch (error) {
    console.error('❌ Failed to get chat list:', error);
    throw new Error(`Chat list retrieval failed: ${error.message}`);
  }
}

/**
 * Get conversation with a specific friend
 * @param {string} userId - Current user's profile ID
 * @param {string} friendId - Friend's profile ID
 * @returns {Object} Conversation details with messages
 */
async function getConversation(userId, friendId) {
  try {
    // Validate friendship
    const user = await User.findOne({ profileId: userId });
    if (!user || !user.friends.includes(friendId)) {
      throw new Error('Cannot access conversation with non-friend user');
    }

    // Get friend information
    const friend = await User.findOne({ profileId: friendId });
    if (!friend) {
      throw new Error('Friend not found');
    }

    // Get messages between users
    const messages = await getDecryptedMessages(userId, friendId);

    // Get unread count
    const unreadCount = await Message.countDocuments({
      senderId: friendId,
      receiverId: userId,
      status: { $ne: 'read' }
    });

    return {
      friend: {
        profileId: friend.profileId,
        username: friend.username,
        displayName: friend.displayName || friend.username,
        isOnline: friend.isOnline || false,
        lastSeen: friend.lastSeen
      },
      messages: messages,
      unreadCount: unreadCount,
      totalMessages: messages.length
    };
  } catch (error) {
    console.error('❌ Failed to get conversation:', error);
    throw new Error(`Conversation retrieval failed: ${error.message}`);
  }
}

/**
 * Mark messages as read in a conversation
 * @param {string} userId - Current user's profile ID
 * @param {string} friendId - Friend's profile ID
 * @returns {Object} Update result
 */
async function markConversationAsRead(userId, friendId) {
  try {
    // Validate friendship
    const user = await User.findOne({ profileId: userId });
    if (!user || !user.friends.includes(friendId)) {
      throw new Error('Cannot access conversation with non-friend user');
    }

    // Mark all messages from friend as read
    const result = await Message.updateMany(
      { senderId: friendId, receiverId: userId, status: { $ne: 'read' } },
      { status: 'read', readAt: new Date() }
    );

    return {
      success: true,
      updatedCount: result.modifiedCount,
      message: 'Messages marked as read'
    };
  } catch (error) {
    console.error('❌ Failed to mark conversation as read:', error);
    throw new Error(`Mark as read failed: ${error.message}`);
  }
}

/**
 * Get chat statistics for a user
 * @param {string} userId - User's profile ID
 * @returns {Object} Chat statistics
 */
async function getChatStats(userId) {
  try {
    const totalMessages = await Message.countDocuments({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    });

    const unreadMessages = await Message.countDocuments({
      receiverId: userId,
      status: { $ne: 'read' }
    });

    const totalConversations = await Message.distinct('senderId', {
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    });

    return {
      totalMessages,
      unreadMessages,
      totalConversations: totalConversations.length,
      lastActivity: await Message.findOne({
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ]
      }).sort({ timestamp: -1 }).select('timestamp')
    };
  } catch (error) {
    console.error('❌ Failed to get chat stats:', error);
    throw new Error(`Chat stats retrieval failed: ${error.message}`);
  }
}

module.exports = {
  getChatList,
  getConversation,
  markConversationAsRead,
  getChatStats
};
