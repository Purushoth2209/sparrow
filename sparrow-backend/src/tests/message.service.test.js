// Mock dependencies BEFORE requiring the service
jest.mock('../repositories/message.repository');
jest.mock('../repositories/user.repository');

// Create a mock encryption service
const mockEncryptionService = {
  encryptMessageOptimized: jest.fn(),
  decryptMessageOptimized: jest.fn(),
  batchEncryptMessages: jest.fn(),
  getStats: jest.fn()
};

// Mock the encryption service module - must be before requiring message.service
jest.mock('../utils/optimizedKmsEncryption', () => {
  return jest.fn().mockImplementation(() => mockEncryptionService);
});

// Now require the service after mocks are set up
const messageService = require('../services/message.service');
const messageRepository = require('../repositories/message.repository');
const userRepository = require('../repositories/user.repository');

describe('Message Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    const mockSender = {
      profileId: 'sender-123',
      friends: ['receiver-456']
    };

    const mockEncryptedPackage = {
      encryptedContent: 'encrypted_content',
      iv: 'iv_data',
      authTag: 'auth_tag',
      algorithm: 'aes-256-gcm',
      encryptedDEK: Buffer.from('encrypted_dek'),
      keyId: 'key-id',
      encryptionContext: { Purpose: 'message-encryption' },
      version: 'optimized-v1',
      sessionId: 'sender-123-receiver-456'
    };

    const mockMessage = {
      _id: 'msg-123',
      senderId: 'sender-123',
      receiverId: 'receiver-456',
      toObject: jest.fn(() => ({
        _id: 'msg-123',
        senderId: 'sender-123',
        receiverId: 'receiver-456',
        encryptedContent: 'encrypted_content'
      }))
    };

    it('should successfully send a message', async () => {
      userRepository.findUserByProfileId.mockResolvedValue(mockSender);
      mockEncryptionService.encryptMessageOptimized.mockResolvedValue(mockEncryptedPackage);
      messageRepository.createMessage.mockResolvedValue(mockMessage);

      const result = await messageService.sendMessage('sender-123', 'receiver-456', 'Hello World');

      expect(result._id).toBe('msg-123');
      expect(userRepository.findUserByProfileId).toHaveBeenCalledWith('sender-123');
      expect(mockEncryptionService.encryptMessageOptimized).toHaveBeenCalledWith(
        'Hello World',
        'sender-123-receiver-456'
      );
      expect(messageRepository.createMessage).toHaveBeenCalled();
    });

    it('should throw error if sender not found', async () => {
      userRepository.findUserByProfileId.mockResolvedValue(null);

      await expect(
        messageService.sendMessage('invalid-sender', 'receiver-456', 'Hello')
      ).rejects.toThrow('Sender not found');
    });

    it('should throw error if receiver is not a friend', async () => {
      const senderWithoutFriend = {
        profileId: 'sender-123',
        friends: []
      };
      userRepository.findUserByProfileId.mockResolvedValue(senderWithoutFriend);

      await expect(
        messageService.sendMessage('sender-123', 'receiver-456', 'Hello')
      ).rejects.toThrow('Cannot send message to non-friend user');
    });
  });

  describe('decryptSingleMessage', () => {
    it('should decrypt encrypted message', async () => {
      const mockMessage = {
        isEncrypted: true,
        senderId: 'sender-123',
        receiverId: 'receiver-456',
        sessionId: 'sender-123-receiver-456',
        encryptedContent: 'encrypted_content',
        iv: 'iv_data',
        authTag: 'auth_tag',
        algorithm: 'aes-256-gcm',
        encryptedDEK: Buffer.from('encrypted_dek'),
        keyId: 'key-id',
        encryptionContext: { Purpose: 'message-encryption' },
        toObject: jest.fn(() => ({
          senderId: 'sender-123',
          receiverId: 'receiver-456'
        }))
      };

      mockEncryptionService.decryptMessageOptimized.mockResolvedValue('Decrypted message');

      const result = await messageService.decryptSingleMessage(mockMessage);

      expect(result.content).toBe('Decrypted message');
      expect(mockEncryptionService.decryptMessageOptimized).toHaveBeenCalled();
    });

    it('should return message as-is if not encrypted', async () => {
      const mockMessage = {
        isEncrypted: false,
        content: 'Plain text message',
        toObject: jest.fn(() => ({ content: 'Plain text message' }))
      };

      const result = await messageService.decryptSingleMessage(mockMessage);

      expect(result.content).toBe('Plain text message');
      expect(mockEncryptionService.decryptMessageOptimized).not.toHaveBeenCalled();
    });
  });

  describe('getDecryptedMessages', () => {
    it('should retrieve and decrypt messages', async () => {
      const mockMessages = [
        {
          isEncrypted: true,
          _id: 'msg-1',
          senderId: 'sender-123',
          receiverId: 'receiver-456',
          toObject: jest.fn(() => ({ _id: 'msg-1' }))
        },
        {
          isEncrypted: false,
          _id: 'msg-2',
          content: 'Plain message',
          toObject: jest.fn(() => ({ _id: 'msg-2', content: 'Plain message' }))
        }
      ];

      messageRepository.findMessagesByUsers.mockResolvedValue(mockMessages);
      mockEncryptionService.decryptMessageOptimized.mockResolvedValue('Decrypted message');

      const result = await messageService.getDecryptedMessages('user-123', 'friend-456');

      expect(result.length).toBe(2);
      expect(messageRepository.findMessagesByUsers).toHaveBeenCalledWith('user-123', 'friend-456');
    });

    it('should handle decryption errors gracefully', async () => {
      const mockMessages = [
        {
          isEncrypted: true,
          _id: 'msg-1',
          toObject: jest.fn(() => ({ _id: 'msg-1' }))
        }
      ];

      messageRepository.findMessagesByUsers.mockResolvedValue(mockMessages);
      mockEncryptionService.decryptMessageOptimized.mockRejectedValue(new Error('Decryption failed'));

      const result = await messageService.getDecryptedMessages('user-123');

      expect(result[0].decryptionError).toBe(true);
      expect(result[0].content).toBe('[Message could not be decrypted]');
    });
  });

  describe('sendBatchMessages', () => {
    it('should successfully send batch messages', async () => {
      const mockSender = {
        profileId: 'sender-123',
        friends: ['receiver-456']
      };

      const messages = [
        { senderId: 'sender-123', receiverId: 'receiver-456', content: 'Message 1', id: 1 },
        { senderId: 'sender-123', receiverId: 'receiver-456', content: 'Message 2', id: 2 }
      ];

      const mockEncryptedMessages = [
        {
          encryptedContent: 'enc1',
          iv: 'iv1',
          authTag: 'tag1',
          algorithm: 'aes-256-gcm',
          encryptedDEK: Buffer.from('dek1'),
          keyId: 'key1',
          encryptionContext: {},
          version: 'v1',
          sessionId: 'sender-123-receiver-456',
          messageId: 1
        },
        {
          encryptedContent: 'enc2',
          iv: 'iv2',
          authTag: 'tag2',
          algorithm: 'aes-256-gcm',
          encryptedDEK: Buffer.from('dek2'),
          keyId: 'key2',
          encryptionContext: {},
          version: 'v1',
          sessionId: 'sender-123-receiver-456',
          messageId: 2
        }
      ];

      userRepository.findUserByProfileId.mockResolvedValue(mockSender);
      mockEncryptionService.batchEncryptMessages.mockResolvedValue(mockEncryptedMessages);
      messageRepository.createMessage
        .mockResolvedValueOnce({ _id: 'msg-1', toObject: () => ({ _id: 'msg-1' }) })
        .mockResolvedValueOnce({ _id: 'msg-2', toObject: () => ({ _id: 'msg-2' }) });

      const result = await messageService.sendBatchMessages(messages);

      expect(result.length).toBe(2);
      expect(mockEncryptionService.batchEncryptMessages).toHaveBeenCalled();
    });

    it('should throw error for empty messages array', async () => {
      await expect(messageService.sendBatchMessages([])).rejects.toThrow(
        'Messages array is required and cannot be empty'
      );
    });

    it('should throw error if sender not found', async () => {
      userRepository.findUserByProfileId.mockResolvedValue(null);

      await expect(
        messageService.sendBatchMessages([
          { senderId: 'invalid', receiverId: 'receiver-456', content: 'Message' }
        ])
      ).rejects.toThrow('Sender invalid not found');
    });
  });

  describe('markMessagesAsRead', () => {
    it('should mark messages as read', async () => {
      const mockResult = { modifiedCount: 5 };
      messageRepository.updateMessagesStatus.mockResolvedValue(mockResult);

      const result = await messageService.markMessagesAsRead('sender-123', 'receiver-456');

      expect(result.modifiedCount).toBe(5);
      expect(messageRepository.updateMessagesStatus).toHaveBeenCalledWith(
        {
          senderId: 'sender-123',
          receiverId: 'receiver-456',
          status: { $ne: 'read' }
        },
        'read',
        { readAt: expect.any(Date) }
      );
    });
  });

  describe('getEncryptionStats', () => {
    it('should return encryption statistics', async () => {
      const mockMessageStats = {
        total: 100,
        encrypted: 80,
        plainText: 20,
        encryptionPercentage: '80.00'
      };

      const mockOptimizationStats = {
        cacheHitRate: 95.5,
        kmsCalls: 10,
        cacheSize: 50
      };

      messageRepository.getEncryptionStats.mockResolvedValue(mockMessageStats);
      mockEncryptionService.getStats.mockReturnValue(mockOptimizationStats);

      const result = await messageService.getEncryptionStats();

      expect(result.total).toBe(100);
      expect(result.encrypted).toBe(80);
      expect(result.optimization).toEqual(mockOptimizationStats);
    });
  });
});

