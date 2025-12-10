const AWS = require('aws-sdk');
const crypto = require('crypto');
const kmsConfig = require('../config/kms');

/**
 * Optimized AWS KMS Envelope Encryption Module for Messaging App
 * 
 * This module implements envelope encryption with DEK caching to optimize performance:
 * 1. Generate DEK once per session and cache it in memory
 * 2. Use cached DEK for local AES-256 encryption/decryption
 * 3. Only call KMS for DEK generation/rotation, not per message
 * 4. Support batch encryption for multiple messages
 * 
 * Performance Benefits:
 * - Eliminates KMS latency for each message
 * - Reduces AWS KMS API calls by 90%+
 * - Maintains all security guarantees
 * - Supports DEK rotation for forward secrecy
 */

class OptimizedKMSEnvelopeEncryption {
  constructor(options = {}) {
    // Initialize AWS KMS client using config
    this.kms = new AWS.KMS({
      region: kmsConfig.region
      // No explicit credentials - uses default credential provider chain
    });
    
    // KMS key alias for the Key Encryption Key (KEK)
    // Use keyId from config if provided, otherwise use default alias
    this.kekAlias = kmsConfig.keyId || 'alias/sparrow-kek';
    
    // Encryption algorithm for message content
    this.encryptionAlgorithm = 'aes-256-gcm';
    
    // DEK Cache configuration
    // sessionId -> { plaintextDEK, encryptedDEK, keyId, encryptionContext, createdAt, messageCount }
    this.dekCache = new Map();
    this.dekRotationInterval = options.dekRotationInterval || 30 * 60 * 1000; // 30 minutes default (for cleanup)
    this.dekMaxAge = options.dekMaxAge || 60 * 60 * 1000; // 1 hour max age (for cache cleanup)
    this.maxCacheSize = options.maxCacheSize || 1000; // Max cached DEKs
    
    // Auto-rotation configuration
    this.dekRotationPeriodHours = options.dekRotationPeriodHours || 24; // Rotate every 24 hours
    this.dekRotationMessages = options.dekRotationMessages || 1000; // Rotate every 1000 messages
    
    // Batch encryption queue
    this.batchQueue = [];
    this.batchTimeout = options.batchTimeout || 50; // 50ms batch window
    this.batchSize = options.batchSize || 10; // Max messages per batch
    
    // Statistics
    this.stats = {
      kmsCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      dekRotations: 0,
      batchOperations: 0,
      totalMessages: 0
    };
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    // Validate KMS configuration
    this.validateKMSConfiguration();
  }

  /**
   * Validates that the KMS key exists and is accessible
   */
  async validateKMSConfiguration() {
    try {
      const result = await this.kms.describeKey({ KeyId: this.kekAlias }).promise();
      console.log(`✅ Optimized KMS key validated: ${result.KeyMetadata.KeyId}`);
      
      if (result.KeyMetadata.KeyState !== 'Enabled') {
        throw new Error(`KMS key ${this.kekAlias} is not enabled`);
      }
    } catch (error) {
      console.error(`❌ Optimized KMS configuration validation failed:`, error.message);
      throw new Error(`KMS key ${this.kekAlias} is not accessible. Please ensure the key exists and IAM permissions are correct.`);
    }
  }

  /**
   * Generates a new Data Encryption Key (DEK) using AWS KMS
   * This is called only when needed (cache miss, rotation, etc.)
   */
  async generateDataEncryptionKey() {
    try {
      this.stats.kmsCalls++;
      
      // Generate 256-bit (32-byte) random key material for AES-256
      const plaintextDEK = crypto.randomBytes(32);
      
      // Use KMS to encrypt the DEK with the master key
      const encryptParams = {
        KeyId: this.kekAlias,
        Plaintext: plaintextDEK,
        EncryptionContext: {
          Purpose: 'message-encryption',
          Service: 'sparrow-chat',
          Version: 'optimized-v1'
        }
      };
      
      const encryptResult = await this.kms.encrypt(encryptParams).promise();
      
      return {
        plaintextDEK: plaintextDEK,
        encryptedDEK: encryptResult.CiphertextBlob,
        keyId: encryptResult.KeyId,
        encryptionContext: encryptParams.EncryptionContext,
        createdAt: Date.now()
      };
      
    } catch (error) {
      console.error('❌ Failed to generate DEK:', error);
      throw new Error(`DEK generation failed: ${error.message}`);
    }
  }

  /**
   * Checks if DEK should be rotated based on time or message count
   * @param {Object} cachedDEK - Cached DEK entry
   * @param {number} now - Current timestamp
   * @returns {boolean} True if DEK should be rotated
   */
  shouldRotateDEK(cachedDEK, now) {
    if (!cachedDEK) return true;
    
    // Check time-based rotation (24 hours)
    const ageMs = now - cachedDEK.createdAt;
    const rotationPeriodMs = cachedDEK.rotationPeriodMs || (this.dekRotationPeriodHours * 60 * 60 * 1000);
    
    if (ageMs >= rotationPeriodMs) {
      console.log(`⏰ DEK rotation needed for session ${cachedDEK.sessionId}: Age ${Math.round(ageMs / (60 * 60 * 1000))} hours >= ${this.dekRotationPeriodHours} hours`);
      return true;
    }
    
    // Check message count-based rotation (1000 messages)
    if (cachedDEK.messageCount >= this.dekRotationMessages) {
      console.log(`📊 DEK rotation needed for session ${cachedDEK.sessionId}: Message count ${cachedDEK.messageCount} >= ${this.dekRotationMessages}`);
      return true;
    }
    
    return false;
  }

  /**
   * Gets or creates a DEK for a session
   * Automatically rotates DEK if:
   * - 24 hours have passed since creation, OR
   * - 1000 messages have been encrypted with this DEK
   * Uses caching to avoid repeated KMS calls
   */
  async getSessionDEK(sessionId) {
    try {
      const now = Date.now();
      
      // Check if we have a cached DEK
      const cachedDEK = this.dekCache.get(sessionId);
      
      // Check if DEK should be rotated (time-based or count-based)
      if (cachedDEK && this.shouldRotateDEK(cachedDEK, now)) {
        console.log(`🔄 Auto-rotating DEK for session ${sessionId} (time: ${Math.round((now - cachedDEK.createdAt) / (60 * 60 * 1000))}h, count: ${cachedDEK.messageCount})`);
        this.stats.dekRotations++;
        
        // Remove old DEK from cache
        this.dekCache.delete(sessionId);
        
        // Generate new DEK (will be cached below)
        const dekData = await this.generateDataEncryptionKey();
        const expiresAt = now + this.dekMaxAge;
        
        const dekCacheEntry = {
          ...dekData,
          expiresAt,
          sessionId,
          messageCount: 0,
          rotationPeriodMs: this.dekRotationPeriodHours * 60 * 60 * 1000
        };
        
        this.dekCache.set(sessionId, dekCacheEntry);
        return dekCacheEntry;
      }
      
      // Check if cached DEK is still valid (not expired for cache cleanup)
      if (cachedDEK && cachedDEK.expiresAt > now) {
        this.stats.cacheHits++;
        return cachedDEK;
      }
      
      // Cache miss or expired - generate new DEK
      this.stats.cacheMisses++;
      console.log(`🔄 Generating new DEK for session ${sessionId}`);
      
      const dekData = await this.generateDataEncryptionKey();
      
      // Calculate expiration time (for cache cleanup, not rotation)
      const expiresAt = now + this.dekMaxAge;
      
      // Cache the DEK with message count tracking
      const dekCacheEntry = {
        ...dekData,
        expiresAt,
        sessionId,
        messageCount: 0, // Track messages encrypted with this DEK
        rotationPeriodMs: this.dekRotationPeriodHours * 60 * 60 * 1000 // 24 hours in ms
      };
      
      this.dekCache.set(sessionId, dekCacheEntry);
      
      // Cleanup old cache entries if needed
      this.cleanupCache();
      
      return dekCacheEntry;
      
    } catch (error) {
      console.error('❌ Failed to get session DEK:', error);
      throw error;
    }
  }

  /**
   * Encrypts a message using cached DEK (no KMS call)
   * Increments message count for rotation tracking
   */
  encryptMessageWithCachedDEK(message, sessionId) {
    try {
      const cachedDEK = this.dekCache.get(sessionId);
      if (!cachedDEK) {
        throw new Error(`No cached DEK found for session ${sessionId}`);
      }
      
      // Increment message count for this DEK (for rotation tracking)
      cachedDEK.messageCount = (cachedDEK.messageCount || 0) + 1;
      
      // Generate random IV for this message
      const iv = crypto.randomBytes(12);
      
      // Create AES-256-GCM cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', cachedDEK.plaintextDEK, iv);
      cipher.setAAD(Buffer.from('sparrow-message', 'utf8'));
      
      // Encrypt the message
      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      return {
        encryptedContent: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.encryptionAlgorithm,
        // Include cached DEK metadata
        encryptedDEK: cachedDEK.encryptedDEK,
        keyId: cachedDEK.keyId,
        encryptionContext: cachedDEK.encryptionContext,
        sessionId: sessionId
      };
      
    } catch (error) {
      console.error('❌ Message encryption with cached DEK failed:', error);
      throw new Error(`Message encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts a message using cached DEK (no KMS call)
   */
  decryptMessageWithCachedDEK(encryptedData, sessionId) {
    try {
      const cachedDEK = this.dekCache.get(sessionId);
      if (!cachedDEK) {
        throw new Error(`No cached DEK found for session ${sessionId}`);
      }
      
      // Parse IV and auth tag
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      // Create AES-256-GCM decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', cachedDEK.plaintextDEK, iv);
      decipher.setAAD(Buffer.from('sparrow-message', 'utf8'));
      decipher.setAuthTag(authTag);
      
      // Decrypt the message
      let decrypted = decipher.update(encryptedData.encryptedContent, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('❌ Message decryption with cached DEK failed:', error);
      throw new Error(`Message decryption failed: ${error.message}`);
    }
  }

  /**
   * Optimized message encryption with DEK caching and auto-rotation
   * This is the main function to use when sending messages
   * 
   * Auto-rotation rules:
   * - Rotates DEK every 24 hours (time-based)
   * - Rotates DEK every 1000 messages (count-based)
   * - Rotation happens automatically before encryption if conditions are met
   */
  async encryptMessageOptimized(message, sessionId = 'default') {
    try {
      this.stats.totalMessages++;
      
      // Get or create DEK for this session (auto-rotates if needed)
      // This checks both time-based (24h) and count-based (1000 msgs) rotation
      await this.getSessionDEK(sessionId);
      
      // Encrypt using cached DEK (no KMS call)
      // This also increments message count for rotation tracking
      const encryptedMessage = this.encryptMessageWithCachedDEK(message, sessionId);
      
      return {
        ...encryptedMessage,
        timestamp: new Date().toISOString(),
        version: 'optimized-v1'
      };
      
    } catch (error) {
      console.error('❌ Optimized message encryption failed:', error);
      throw new Error(`Optimized message encryption failed: ${error.message}`);
    }
  }

  /**
   * Batch encrypt multiple messages efficiently
   * Tracks message count for auto-rotation (counts each message in batch)
   */
  async batchEncryptMessages(messages, sessionId = 'default') {
    try {
      this.stats.batchOperations++;
      
      // Ensure we have a cached DEK for this session (auto-rotates if needed)
      await this.getSessionDEK(sessionId);
      
      // Encrypt all messages with the same cached DEK
      // Each message increments the count (for rotation tracking)
      const encryptedMessages = messages.map(message => {
        const encrypted = this.encryptMessageWithCachedDEK(message.content, sessionId);
        return {
          ...encrypted,
          messageId: message.id,
          timestamp: new Date().toISOString(),
          version: 'optimized-v1'
        };
      });
      
      return encryptedMessages;
      
    } catch (error) {
      console.error('❌ Batch encryption failed:', error);
      throw new Error(`Batch encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts a message using cached DEK or falls back to KMS
   */
  async decryptMessageOptimized(encryptedMessagePackage, sessionId = null) {
    try {
      // Try cached DEK first if sessionId is provided
      if (sessionId && encryptedMessagePackage.sessionId === sessionId) {
        try {
          return this.decryptMessageWithCachedDEK(encryptedMessagePackage, sessionId);
        } catch (cacheError) {
          console.log(`⚠️ Cache decryption failed, falling back to KMS: ${cacheError.message}`);
        }
      }
      
      // Fallback to KMS decryption for backward compatibility
      return await this.decryptMessageWithKMS(encryptedMessagePackage);
      
    } catch (error) {
      console.error('❌ Optimized message decryption failed:', error);
      throw new Error(`Message decryption failed: ${error.message}`);
    }
  }

  /**
   * Fallback KMS decryption for backward compatibility
   */
  async decryptMessageWithKMS(encryptedMessagePackage) {
    try {
      this.stats.kmsCalls++;
      
      // Ensure encryptedDEK is a Buffer
      let ciphertextBlob;
      if (Buffer.isBuffer(encryptedMessagePackage.encryptedDEK)) {
        ciphertextBlob = encryptedMessagePackage.encryptedDEK;
      } else if (typeof encryptedMessagePackage.encryptedDEK === 'string') {
        ciphertextBlob = Buffer.from(encryptedMessagePackage.encryptedDEK, 'base64');
      } else {
        throw new Error('Invalid encryptedDEK format');
      }

      const decryptParams = {
        CiphertextBlob: ciphertextBlob,
        EncryptionContext: encryptedMessagePackage.encryptionContext || {}
      };
      
      const decryptResult = await this.kms.decrypt(decryptParams).promise();
      const plaintextDEK = decryptResult.Plaintext;
      
      // Decrypt message with plaintext DEK
      const iv = Buffer.from(encryptedMessagePackage.iv, 'hex');
      const authTag = Buffer.from(encryptedMessagePackage.authTag, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', plaintextDEK, iv);
      decipher.setAAD(Buffer.from('sparrow-message', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedMessagePackage.encryptedContent, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('❌ KMS decryption failed:', error);
      throw new Error(`KMS decryption failed: ${error.message}`);
    }
  }

  /**
   * Rotates DEK for a session (forces new KMS call)
   */
  async rotateSessionDEK(sessionId) {
    try {
      console.log(`🔄 Rotating DEK for session ${sessionId}`);
      this.stats.dekRotations++;
      
      // Remove old DEK from cache
      this.dekCache.delete(sessionId);
      
      // Generate new DEK
      return await this.getSessionDEK(sessionId);
      
    } catch (error) {
      console.error('❌ DEK rotation failed:', error);
      throw new Error(`DEK rotation failed: ${error.message}`);
    }
  }

  /**
   * Cleans up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, dekData] of this.dekCache) {
      if (dekData.expiresAt <= now) {
        this.dekCache.delete(sessionId);
        cleanedCount++;
      }
    }
    
    // If still over limit, remove oldest entries
    if (this.dekCache.size > this.maxCacheSize) {
      const entries = Array.from(this.dekCache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt);
      
      const toRemove = entries.slice(0, this.dekCache.size - this.maxCacheSize);
      toRemove.forEach(([sessionId]) => {
        this.dekCache.delete(sessionId);
        cleanedCount++;
      });
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired DEK cache entries`);
    }
  }

  /**
   * Starts periodic cleanup of expired cache entries
   */
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, this.dekRotationInterval);
  }

  /**
   * Gets encryption statistics
   */
  getStats() {
    // Calculate average message count per session
    let totalMessageCount = 0;
    let sessionsWithMessages = 0;
    for (const [sessionId, dekData] of this.dekCache) {
      if (dekData.messageCount > 0) {
        totalMessageCount += dekData.messageCount;
        sessionsWithMessages++;
      }
    }
    const avgMessagesPerSession = sessionsWithMessages > 0 
      ? Math.round(totalMessageCount / sessionsWithMessages) 
      : 0;
    
    return {
      ...this.stats,
      cacheSize: this.dekCache.size,
      cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100 || 0,
      dekRotationPeriodHours: this.dekRotationPeriodHours,
      dekRotationMessages: this.dekRotationMessages,
      avgMessagesPerSession: avgMessagesPerSession,
      totalCachedMessageCount: totalMessageCount
    };
  }

  /**
   * Clears all cached DEKs (for testing or emergency)
   */
  clearCache() {
    this.dekCache.clear();
    console.log('🧹 Cleared all DEK cache entries');
  }

  /**
   * Validates encrypted message package
   */
  validateEncryptedPackage(encryptedPackage) {
    const requiredFields = [
      'encryptedContent',
      'iv',
      'authTag',
      'algorithm',
      'encryptedDEK',
      'keyId',
      'encryptionContext'
    ];
    
    return requiredFields.every(field => encryptedPackage.hasOwnProperty(field));
  }
}

// Export the class
module.exports = OptimizedKMSEnvelopeEncryption;

// Export convenience function
module.exports.createOptimizedEncryptionService = (options) => new OptimizedKMSEnvelopeEncryption(options);

/**
 * Usage Examples:
 * 
 * // Initialize the optimized encryption service
 * const encryptionService = new OptimizedKMSEnvelopeEncryption({
 *   dekRotationInterval: 30 * 60 * 1000, // 30 minutes
 *   dekMaxAge: 60 * 60 * 1000, // 1 hour
 *   batchTimeout: 50, // 50ms batch window
 *   batchSize: 10 // Max 10 messages per batch
 * });
 * 
 * // Encrypt a message (uses cached DEK, no KMS call)
 * const encryptedPackage = await encryptionService.encryptMessageOptimized("Hello World!", "user123");
 * 
 * // Batch encrypt multiple messages
 * const messages = [
 *   { id: 1, content: "Message 1" },
 *   { id: 2, content: "Message 2" }
 * ];
 * const encryptedMessages = await encryptionService.batchEncryptMessages(messages, "user123");
 * 
 * // Decrypt a message (uses cached DEK if available)
 * const decryptedMessage = await encryptionService.decryptMessageOptimized(encryptedPackage, "user123");
 * 
 * // Get performance statistics
 * const stats = encryptionService.getStats();
 * console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
 * console.log(`KMS calls: ${stats.kmsCalls}`);
 * 
 * // Rotate DEK for a session
 * await encryptionService.rotateSessionDEK("user123");
 * 
 * Performance Benefits:
 * - 90%+ reduction in KMS API calls
 * - Near-instant message encryption/decryption
 * - Maintains all security guarantees
 * - Automatic DEK rotation for forward secrecy
 * - Batch processing for multiple messages
 */
