/**
 * Migration Script: Add Message Compression and TTL
 * 
 * This script:
 * 1. Adds compressionType, compressedContent, expireAt fields to existing messages
 * 2. Creates tempIdMappings collection and indexes
 * 3. Creates TTL index on expireAt
 * 4. Compresses existing messages (if possible)
 * 
 * Run: node src/scripts/migrate_add_message_compression_and_ttl.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const TempIdMapping = require('../models/TempIdMapping');
const Conversation = require('../models/Conversation');
const { connectDB } = require('../config/db');
const messageConfig = require('../config/message');
// Compression utilities imported inline where needed

async function migrate() {
  try {
    console.log('🔄 Starting migration: Add Message Compression and TTL');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB');
    
    // Step 1: Update existing messages with expireAt
    console.log('📝 Step 1: Updating existing messages with expireAt...');
    const messages = await Message.find({ expireAt: { $exists: false } });
    console.log(`   Found ${messages.length} messages without expireAt`);
    
    let updatedCount = 0;
    for (const message of messages) {
      const serverTimestamp = message.serverTimestamp || message.timestamp || message.createdAt || new Date();
      const expireAt = new Date(serverTimestamp.getTime() + messageConfig.messageTTLDays * 24 * 60 * 60 * 1000);
      
      // Try to compress existing encrypted content if not already compressed
      let compressedContent = null;
      const compressionTypes = require('../constants/compressionTypes');
      let compressionType = compressionTypes.NONE;
      let uncompressedSize = null;
      
      if (message.isEncrypted && message.encryptedContent && !message.compressedContent) {
        try {
          // Convert hex to buffer, then compress
          const encryptedBuffer = Buffer.from(message.encryptedContent, 'hex');
          const { compressBuffer } = require('../utils/compression');
          const compressionResult = await compressBuffer(
            encryptedBuffer,
            messageConfig.compressionAlgorithm
          );
          compressedContent = compressionResult.compressedBuffer;
          compressionType = compressionResult.compressionType;
          uncompressedSize = compressionResult.uncompressedSize;
        } catch (compressError) {
          console.warn(`   ⚠️ Failed to compress message ${message._id}: ${compressError.message}`);
          // Continue without compression
        }
      }
      
      await Message.findByIdAndUpdate(message._id, {
        serverTimestamp: serverTimestamp,
        expireAt: expireAt,
        compressionType: compressionType,
        compressedContent: compressedContent,
        uncompressedSize: uncompressedSize
      });
      
      updatedCount++;
      if (updatedCount % 100 === 0) {
        console.log(`   Updated ${updatedCount}/${messages.length} messages...`);
      }
    }
    console.log(`✅ Updated ${updatedCount} messages with expireAt and compression`);
    
    // Step 2: Create TTL index on expireAt
    console.log('📝 Step 2: Creating TTL index on expireAt...');
    try {
      await Message.collection.createIndex(
        { expireAt: 1 },
        { expireAfterSeconds: 0, name: 'expireAt_ttl' }
      );
      console.log('✅ TTL index created on expireAt');
    } catch (indexError) {
      if (indexError.code === 85) {
        console.log('   ℹ️ TTL index already exists');
      } else {
        throw indexError;
      }
    }
    
    // Step 3: Create tempIdMappings indexes
    console.log('📝 Step 3: Creating tempIdMappings indexes...');
    try {
      await TempIdMapping.collection.createIndex(
        { tempId: 1, senderId: 1 },
        { unique: true, name: 'tempId_senderId_unique' }
      );
      await TempIdMapping.collection.createIndex(
        { messageId: 1 },
        { name: 'messageId_index' }
      );
      console.log('✅ tempIdMappings indexes created');
    } catch (indexError) {
      if (indexError.code === 85) {
        console.log('   ℹ️ tempIdMappings indexes already exist');
      } else {
        throw indexError;
      }
    }
    
    // Step 4: Create conversations indexes
    console.log('📝 Step 4: Creating conversations indexes...');
    try {
      await Conversation.collection.createIndex(
        { conversationId: 1 },
        { unique: true, name: 'conversationId_unique' }
      );
      await Conversation.collection.createIndex(
        { participants: 1 },
        { name: 'participants_index' }
      );
      await Conversation.collection.createIndex(
        { lastMessageTimestamp: -1 },
        { name: 'lastMessageTimestamp_index' }
      );
      console.log('✅ conversations indexes created');
    } catch (indexError) {
      if (indexError.code === 85) {
        console.log('   ℹ️ conversations indexes already exist');
      } else {
        throw indexError;
      }
    }
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();

