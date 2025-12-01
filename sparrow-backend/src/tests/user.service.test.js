const userService = require('../services/user.service');
const userRepository = require('../repositories/user.repository');

// Mock dependencies
jest.mock('../repositories/user.repository');

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('should return current user data', async () => {
      const mockUser = {
        profileId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        fullName: 'Test User',
        profileImage: 'image.jpg'
      };

      userRepository.findUserByProfileId.mockResolvedValue(mockUser);

      const result = await userService.getCurrentUser('user-123');

      expect(result.profileId).toBe('user-123');
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(userRepository.findUserByProfileId).toHaveBeenCalledWith('user-123');
    });

    it('should handle null email and phoneNumber', async () => {
      const mockUser = {
        profileId: 'user-123',
        username: 'testuser',
        email: null,
        phoneNumber: null,
        fullName: 'Test User',
        profileImage: ''
      };

      userRepository.findUserByProfileId.mockResolvedValue(mockUser);

      const result = await userService.getCurrentUser('user-123');

      expect(result.email).toBe(null);
      expect(result.phoneNumber).toBe(null);
    });

    it('should throw error if user not found', async () => {
      userRepository.findUserByProfileId.mockResolvedValue(null);

      await expect(userService.getCurrentUser('invalid-id')).rejects.toThrow('User not found');
    });
  });
});

