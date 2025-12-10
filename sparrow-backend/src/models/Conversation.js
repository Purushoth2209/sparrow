const mongoose = require('mongoose');

/**
 * Conversation Schema
 * Tracks conversation metadata and unread counts
 */
const ConversationSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  participants: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length === 2; // Exactly 2 participants
      },
      message: 'Conversation must have exactly 2 participants'
    }
  },
  lastMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastMessagePreview: {
    type: String,
    default: ''
  },
  lastMessageTimestamp: {
    type: Date,
    default: Date.now
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  // Mute and archive status per user
  // Map<profileId, { muted: boolean, archived: boolean }>
  userSettings: {
    type: Map,
    of: {
      muted: { type: Boolean, default: false },
      archived: { type: Boolean, default: false },
      mutedAt: { type: Date, default: null },
      archivedAt: { type: Date, default: null }
    },
    default: new Map()
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'conversations'
});

// Index for finding conversations by participant
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageTimestamp: -1 });

// Helper method to generate conversationId from two user IDs
ConversationSchema.statics.getConversationId = function(userId1, userId2) {
  // Sort IDs to ensure consistent conversationId regardless of order
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

// Helper method to find or create conversation
ConversationSchema.statics.findOrCreate = async function(userId1, userId2) {
  const conversationId = this.getConversationId(userId1, userId2);
  let conversation = await this.findOne({ conversationId });
  
  if (!conversation) {
    conversation = await this.create({
      conversationId,
      participants: [userId1, userId2],
      unreadCounts: new Map([
        [userId1, 0],
        [userId2, 0]
      ])
    });
  }
  
  return conversation;
};

const Conversation = mongoose.model('Conversation', ConversationSchema);

module.exports = Conversation;
