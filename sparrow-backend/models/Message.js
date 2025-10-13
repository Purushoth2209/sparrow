const mongoose = require('mongoose');

/**
 * Enhanced Message Schema with KMS Envelope Encryption Support
 * 
 * This schema supports both encrypted and non-encrypted messages,
 * allowing for gradual migration and backward compatibility.
 */
const MessageSchema = new mongoose.Schema({
  // Standard message fields
  senderId: String,
  receiverId: String,
  timestamp: Date,
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  deliveredAt: Date,
  readAt: Date,
  
  // Legacy content field (for non-encrypted messages)
  content: {
    type: String,
    required: function() {
      return !this.isEncrypted;
    }
  },
  
  // Encryption metadata
  isEncrypted: {
    type: Boolean,
    default: false
  },
  encryptionVersion: {
    type: String,
    default: '1.0'
  },
  
  // Encrypted message fields (for encrypted messages)
  encryptedContent: {
    type: String,
    required: function() {
      return this.isEncrypted;
    }
  },
  iv: {
    type: String,
    required: function() {
      return this.isEncrypted;
    }
  },
  authTag: {
    type: String,
    required: function() {
      return this.isEncrypted;
    }
  },
  algorithm: {
    type: String,
    default: 'aes-256-gcm'
  },
  
  // KMS envelope encryption fields
  encryptedDEK: {
    type: Buffer,
    required: function() {
      return this.isEncrypted;
    }
  },
  keyId: {
    type: String,
    required: function() {
      return this.isEncrypted;
    }
  },
  encryptionContext: {
    type: mongoose.Schema.Types.Mixed,
    required: function() {
      return this.isEncrypted;
    }
  },
  
  // Migration and rollback support
  originalContent: {
    type: String,
    // Keep original content for rollback during migration
  },
  
  // Additional metadata
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'messages'
});

// Indexes for performance
MessageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });
MessageSchema.index({ receiverId: 1, status: 1 });
MessageSchema.index({ timestamp: -1 });
MessageSchema.index({ isEncrypted: 1 });

// Virtual for backward compatibility
MessageSchema.virtual('displayContent').get(function() {
  return this.isEncrypted ? '[Encrypted Message]' : this.content;
});

// Instance methods
MessageSchema.methods.isMessageEncrypted = function() {
  return this.isEncrypted === true;
};

MessageSchema.methods.getEncryptionInfo = function() {
  if (!this.isEncrypted) {
    return { encrypted: false };
  }
  
  return {
    encrypted: true,
    algorithm: this.algorithm,
    keyId: this.keyId,
    version: this.encryptionVersion,
    hasEncryptedDEK: !!this.encryptedDEK
  };
};

// Static methods
MessageSchema.statics.findEncryptedMessages = function(query = {}) {
  return this.find({ ...query, isEncrypted: true });
};

MessageSchema.statics.findPlainTextMessages = function(query = {}) {
  return this.find({ ...query, isEncrypted: { $ne: true } });
};

MessageSchema.statics.getEncryptionStats = async function() {
  const totalMessages = await this.countDocuments();
  const encryptedMessages = await this.countDocuments({ isEncrypted: true });
  const plainTextMessages = totalMessages - encryptedMessages;
  
  return {
    total: totalMessages,
    encrypted: encryptedMessages,
    plainText: plainTextMessages,
    encryptionPercentage: totalMessages > 0 ? (encryptedMessages / totalMessages * 100).toFixed(2) : 0
  };
};

// Pre-save middleware to validate encryption fields
MessageSchema.pre('save', function(next) {
  if (this.isEncrypted) {
    // Validate that all required encryption fields are present
    const requiredFields = ['encryptedContent', 'iv', 'authTag', 'encryptedDEK', 'keyId'];
    const missingFields = requiredFields.filter(field => !this[field]);
    
    if (missingFields.length > 0) {
      return next(new Error(`Missing required encryption fields: ${missingFields.join(', ')}`));
    }
    
    // Validate that content is not set for encrypted messages
    if (this.content && this.content !== this.originalContent) {
      return next(new Error('Content field should not be set for encrypted messages'));
    }
  } else {
    // Validate that content is set for non-encrypted messages
    if (!this.content) {
      return next(new Error('Content field is required for non-encrypted messages'));
    }
    
    // Validate that encryption fields are not set for non-encrypted messages
    const encryptionFields = ['encryptedContent', 'iv', 'authTag', 'encryptedDEK', 'keyId'];
    const setEncryptionFields = encryptionFields.filter(field => this[field]);
    
    if (setEncryptionFields.length > 0) {
      return next(new Error(`Encryption fields should not be set for non-encrypted messages: ${setEncryptionFields.join(', ')}`));
    }
  }
  
  next();
});

// Transform function to exclude sensitive fields from JSON output
MessageSchema.methods.toJSON = function() {
  const obj = this.toObject();
  
  // Always exclude encrypted DEK from JSON output
  delete obj.encryptedDEK;
  
  // Optionally exclude other sensitive fields
  if (process.env.NODE_ENV === 'production') {
    delete obj.encryptionContext;
    delete obj.originalContent;
  }
  
  return obj;
};

const Message = mongoose.model('Message', MessageSchema);

module.exports = Message;

/**
 * Usage Examples:
 * 
 * // Create encrypted message
 * const encryptedMessage = new Message({
 *   senderId: 'user1',
 *   receiverId: 'user2',
 *   isEncrypted: true,
 *   encryptedContent: 'encrypted_data',
 *   iv: 'iv_data',
 *   authTag: 'auth_tag',
 *   encryptedDEK: Buffer.from('encrypted_dek'),
 *   keyId: 'key_id',
 *   encryptionContext: { Purpose: 'message-encryption' }
 * });
 * 
 * // Create plain text message (backward compatibility)
 * const plainMessage = new Message({
 *   senderId: 'user1',
 *   receiverId: 'user2',
 *   content: 'Hello World!'
 * });
 * 
 * // Query encrypted messages only
 * const encryptedMessages = await Message.findEncryptedMessages({ senderId: 'user1' });
 * 
 * // Get encryption statistics
 * const stats = await Message.getEncryptionStats();
 * console.log(`${stats.encryptionPercentage}% of messages are encrypted`);
 */