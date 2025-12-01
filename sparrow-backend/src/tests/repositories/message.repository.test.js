const messageRepository = require('../../repositories/message.repository');
const Message = require('../../models/Message');

// Mock Message model
jest.mock('../../models/Message');

describe('Message Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMessage', () => {
    it('should create a new message', async () => {
      const messageData = {
        senderId: 'user-123',
        receiverId: 'user-456',
        content: 'Hello',
        timestamp: new Date()
      };

      const mockMessage = {
        ...messageData,
        save: jest.fn().mockResolvedValue(messageData)
      };

      Message.mockImplementation(() => mockMessage);

      const result = await messageRepository.createMessage(messageData);

      expect(Message).toHaveBeenCalledWith(messageData);
      expect(mockMessage.save).toHaveBeenCalled();
    });
  });

  describe('findMessagesByUsers', () => {
    it('should find messages between two users', async () => {
      const mockMessages = [
        { senderId: 'user-123', receiverId: 'user-456', content: 'Hello' }
      ];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(mockMessages)
      };

      Message.find.mockReturnValue(mockQuery);

      const result = await messageRepository.findMessagesByUsers('user-123', 'user-456');

      expect(result).toEqual(mockMessages);
      expect(Message.find).toHaveBeenCalled();
    });

    it('should find all messages for a user when friendId is null', async () => {
      const mockMessages = [
        { senderId: 'user-123', receiverId: 'user-456', content: 'Hello' },
        { senderId: 'user-789', receiverId: 'user-123', content: 'Hi' }
      ];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(mockMessages)
      };

      Message.find.mockReturnValue(mockQuery);

      const result = await messageRepository.findMessagesByUsers('user-123');

      expect(result.length).toBe(2);
    });
  });

  describe('updateMessageStatus', () => {
    it('should update message status', async () => {
      const mockUpdatedMessage = {
        _id: 'msg-123',
        status: 'delivered',
        deliveredAt: new Date()
      };

      Message.findByIdAndUpdate.mockResolvedValue(mockUpdatedMessage);

      const result = await messageRepository.updateMessageStatus('msg-123', 'delivered', {
        deliveredAt: new Date()
      });

      expect(result).toEqual(mockUpdatedMessage);
      expect(Message.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      const mockDeletedMessage = { _id: 'msg-123' };
      Message.findByIdAndDelete.mockResolvedValue(mockDeletedMessage);

      const result = await messageRepository.deleteMessage('msg-123');

      expect(result).toEqual(mockDeletedMessage);
      expect(Message.findByIdAndDelete).toHaveBeenCalledWith('msg-123');
    });
  });
});

