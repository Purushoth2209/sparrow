const mongoose = require('mongoose');

/**
 * TempId Mapping Schema
 * Maps client-side temporary IDs to server message IDs for deduplication
 */
const TempIdMappingSchema = new mongoose.Schema({
  tempId: {
    type: String,
    required: true,
    index: true
  },
  senderId: {
    type: String,
    required: true,
    index: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7 * 24 * 60 * 60 // Auto-delete after 7 days
  }
}, {
  timestamps: true,
  collection: 'tempidmappings'
});

// Unique compound index to prevent duplicate mappings
TempIdMappingSchema.index({ tempId: 1, senderId: 1 }, { unique: true });

// Index for quick lookup
TempIdMappingSchema.index({ messageId: 1 });

const TempIdMapping = mongoose.model('TempIdMapping', TempIdMappingSchema);

module.exports = TempIdMapping;


