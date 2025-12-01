const AWS = require('aws-sdk');
const crypto = require('crypto');

/**
 * AWS KMS Envelope Encryption Module for Messaging App
 * 
 * This module implements envelope encryption using AWS KMS for secure message encryption.
 * Envelope encryption uses a two-tier approach:
 * 1. KMS encrypts/decrypts Data Encryption Keys (DEKs)
 * 2. DEKs encrypt/decrypt actual message content
 * 
 * Benefits:
 * - KMS handles master key management and rotation
 * - DEKs are generated per message/session for forward secrecy
 * - Plaintext DEKs never touch persistent storage
 * - Encrypted DEKs can be safely stored in database
 */

class KMSEnvelopeEncryption {
  constructor() {
    // Initialize AWS KMS client with default configuration
    // AWS SDK will automatically use IAM roles in EB environment
    this.kms = new AWS.KMS({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    // KMS key alias for the Key Encryption Key (KEK)
    this.kekAlias = 'alias/sparrow-kek';
    
    // Encryption algorithm for message content
    this.encryptionAlgorithm = 'aes-256-gcm';
    
    // Validate KMS configuration on initialization
    this.validateKMSConfiguration();
  }

  /**
   * Validates that the KMS key exists and is accessible
   * This prevents runtime errors during encryption operations
   */
  async validateKMSConfiguration() {
    try {
      const result = await this.kms.describeKey({ KeyId: this.kekAlias }).promise();
      console.log(`✅ KMS key validated: ${result.KeyMetadata.KeyId}`);
      
      if (result.KeyMetadata.KeyState !== 'Enabled') {
        throw new Error(`KMS key ${this.kekAlias} is not enabled`);
      }
    } catch (error) {
      console.error(`❌ KMS configuration validation failed:`, error.message);
      throw new Error(`KMS key ${this.kekAlias} is not accessible. Please ensure the key exists and IAM permissions are correct.`);
    }
  }

  /**
   * Generates a Data Encryption Key (DEK) using AWS KMS
   * 
   * Process:
   * 1. Generate random 256-bit key material
   * 2. Use KMS to encrypt the DEK with the master key
   * 3. Return both plaintext (for immediate use) and encrypted (for storage) versions
   * 
   * @returns {Object} Contains plaintext DEK and encrypted DEK
   */
  async generateDataEncryptionKey() {
    try {
      // Generate 256-bit (32-byte) random key material for AES-256
      const plaintextDEK = crypto.randomBytes(32);
      
      // Use KMS to encrypt the DEK with the master key
      const encryptParams = {
        KeyId: this.kekAlias,
        Plaintext: plaintextDEK,
        EncryptionContext: {
          // Add context to prevent key reuse across different purposes
          Purpose: 'message-encryption',
          Service: 'sparrow-chat'
        }
      };
      
      const encryptResult = await this.kms.encrypt(encryptParams).promise();
      
      // Return both versions of the DEK
      return {
        // Plaintext DEK - use immediately for encryption, then discard
        plaintextDEK: plaintextDEK,
        
        // Encrypted DEK - safe to store in database
        encryptedDEK: encryptResult.CiphertextBlob,
        
        // Additional metadata for decryption
        keyId: encryptResult.KeyId,
        encryptionContext: encryptParams.EncryptionContext
      };
      
    } catch (error) {
      console.error('❌ Failed to generate DEK:', error);
      throw new Error(`DEK generation failed: ${error.message}`);
    }
  }

  /**
   * Encrypts a message using the provided Data Encryption Key
   * 
   * Process:
   * 1. Generate random IV for this specific message
   * 2. Create AES-256-GCM cipher with DEK and IV
   * 3. Encrypt message content
   * 4. Return encrypted data with IV and auth tag
   * 
   * @param {string} message - Plaintext message to encrypt
   * @param {Buffer} plaintextDEK - Plaintext Data Encryption Key
   * @returns {Object} Encrypted message data
   */
  encryptMessage(message, plaintextDEK) {
    try {
      // Generate random 96-bit (12-byte) IV for GCM mode
      const iv = crypto.randomBytes(12);
      
      // Create AES-256-GCM cipher with IV
      const cipher = crypto.createCipheriv('aes-256-gcm', plaintextDEK, iv);
      cipher.setAAD(Buffer.from('sparrow-message', 'utf8')); // Additional authenticated data
      
      // Encrypt the message
      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag for integrity verification
      const authTag = cipher.getAuthTag();
      
      return {
        encryptedContent: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.encryptionAlgorithm
      };
      
    } catch (error) {
      console.error('❌ Message encryption failed:', error);
      throw new Error(`Message encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts a message using the provided Data Encryption Key
   * 
   * Process:
   * 1. Parse IV and auth tag from encrypted data
   * 2. Create AES-256-GCM decipher with DEK and IV
   * 3. Verify authentication tag for integrity
   * 4. Decrypt message content
   * 
   * @param {Object} encryptedData - Encrypted message data
   * @param {Buffer} plaintextDEK - Plaintext Data Encryption Key
   * @returns {string} Decrypted plaintext message
   */
  decryptMessage(encryptedData, plaintextDEK) {
    try {
      // Parse IV and auth tag from hex strings
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      // Create AES-256-GCM decipher with IV
      const decipher = crypto.createDecipheriv('aes-256-gcm', plaintextDEK, iv);
      decipher.setAAD(Buffer.from('sparrow-message', 'utf8')); // Same AAD as encryption
      decipher.setAuthTag(authTag);
      
      // Decrypt the message
      let decrypted = decipher.update(encryptedData.encryptedContent, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('❌ Message decryption failed:', error);
      throw new Error(`Message decryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts a wrapped Data Encryption Key using AWS KMS
   * 
   * This function is used when reading messages from the database.
   * The encrypted DEK stored in the database is decrypted by KMS
   * to get the plaintext DEK needed for message decryption.
   * 
   * @param {Buffer} encryptedDEK - Encrypted DEK from database
   * @param {Object} encryptionContext - Context used during encryption
   * @returns {Buffer} Plaintext DEK for message decryption
   */
  async decryptDataEncryptionKey(encryptedDEK, encryptionContext = {}) {
    try {
      // Ensure encryptedDEK is a Buffer
      let ciphertextBlob;
      if (Buffer.isBuffer(encryptedDEK)) {
        ciphertextBlob = encryptedDEK;
      } else if (typeof encryptedDEK === 'string') {
        ciphertextBlob = Buffer.from(encryptedDEK, 'base64');
      } else {
        throw new Error('Invalid encryptedDEK format');
      }

      const decryptParams = {
        CiphertextBlob: ciphertextBlob,
        EncryptionContext: encryptionContext
      };
      
      const decryptResult = await this.kms.decrypt(decryptParams).promise();
      
      // Return the plaintext DEK
      return decryptResult.Plaintext;
      
    } catch (error) {
      console.error('❌ DEK decryption failed:', error);
      throw new Error(`DEK decryption failed: ${error.message}`);
    }
  }

  /**
   * Complete message encryption workflow
   * 
   * This is the main function to use when sending a message.
   * It handles the entire envelope encryption process:
   * 1. Generate DEK
   * 2. Encrypt message with DEK
   * 3. Return encrypted message + encrypted DEK for storage
   * 
   * @param {string} message - Plaintext message to encrypt
   * @returns {Object} Complete encrypted message package
   */
  async encryptMessageComplete(message) {
    try {
      // Step 1: Generate Data Encryption Key
      const dekData = await this.generateDataEncryptionKey();
      
      // Step 2: Encrypt message with plaintext DEK
      const encryptedMessage = this.encryptMessage(message, dekData.plaintextDEK);
      
      // Step 3: Return complete package
      return {
        // Encrypted message content
        encryptedContent: encryptedMessage.encryptedContent,
        iv: encryptedMessage.iv,
        authTag: encryptedMessage.authTag,
        algorithm: encryptedMessage.algorithm,
        
        // Encrypted DEK for database storage
        encryptedDEK: dekData.encryptedDEK,
        keyId: dekData.keyId,
        encryptionContext: dekData.encryptionContext,
        
        // Metadata
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
    } catch (error) {
      console.error('❌ Complete encryption workflow failed:', error);
      throw new Error(`Message encryption workflow failed: ${error.message}`);
    }
  }

  /**
   * Complete message decryption workflow
   * 
   * This is the main function to use when reading a message.
   * It handles the entire envelope decryption process:
   * 1. Decrypt DEK using KMS
   * 2. Decrypt message using plaintext DEK
   * 3. Return decrypted message
   * 
   * @param {Object} encryptedMessagePackage - Complete encrypted message package
   * @returns {string} Decrypted plaintext message
   */
  async decryptMessageComplete(encryptedMessagePackage) {
    try {
      // Step 1: Decrypt DEK using KMS
      const plaintextDEK = await this.decryptDataEncryptionKey(
        encryptedMessagePackage.encryptedDEK,
        encryptedMessagePackage.encryptionContext
      );
      
      // Step 2: Decrypt message using plaintext DEK
      const decryptedMessage = this.decryptMessage(
        {
          encryptedContent: encryptedMessagePackage.encryptedContent,
          iv: encryptedMessagePackage.iv,
          authTag: encryptedMessagePackage.authTag,
          algorithm: encryptedMessagePackage.algorithm
        },
        plaintextDEK
      );
      
      return decryptedMessage;
      
    } catch (error) {
      console.error('❌ Complete decryption workflow failed:', error);
      throw new Error(`Message decryption workflow failed: ${error.message}`);
    }
  }

  /**
   * Utility function to validate encrypted message package
   * 
   * @param {Object} encryptedPackage - Encrypted message package to validate
   * @returns {boolean} True if package is valid
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

// Export the class for use in other modules
module.exports = KMSEnvelopeEncryption;

// Export convenience functions for common operations
module.exports.createEncryptionService = () => new KMSEnvelopeEncryption();

/**
 * Usage Examples:
 * 
 * // Initialize the encryption service
 * const encryptionService = new KMSEnvelopeEncryption();
 * 
 * // Encrypt a message (for sending)
 * const encryptedPackage = await encryptionService.encryptMessageComplete("Hello World!");
 * 
 * // Store encryptedPackage in database
 * // encryptedPackage.encryptedContent, encryptedPackage.encryptedDEK, etc.
 * 
 * // Decrypt a message (for reading)
 * const decryptedMessage = await encryptionService.decryptMessageComplete(encryptedPackage);
 * 
 * // Security Notes:
 * // - Plaintext DEKs are only used in memory and never stored
 * // - Encrypted DEKs can be safely stored in database
 * // - Each message uses a unique DEK for forward secrecy
 * // - KMS handles master key rotation automatically
 * // - Authentication tags prevent message tampering
 */
