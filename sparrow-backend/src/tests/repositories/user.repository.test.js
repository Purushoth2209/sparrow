const userRepository = require('../../repositories/user.repository');
const User = require('../../models/User');

// Mock User model
jest.mock('../../models/User');

describe('User Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findUserByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = { email: 'test@example.com', username: 'testuser' };
      User.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });

  describe('findUserByProfileId', () => {
    it('should find user by profileId', async () => {
      const mockUser = { profileId: 'user-123', username: 'testuser' };
      User.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findUserByProfileId('user-123');

      expect(result).toEqual(mockUser);
      expect(User.findOne).toHaveBeenCalledWith({ profileId: 'user-123' });
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedPassword',
        profileId: 'user-123'
      };

      const mockUser = {
        ...userData,
        save: jest.fn().mockResolvedValue(userData)
      };

      User.mockImplementation(() => mockUser);

      const result = await userRepository.createUser(userData);

      expect(User).toHaveBeenCalledWith(userData);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should update user data', async () => {
      const updateData = { isOnline: true, lastSeen: new Date() };
      const mockUpdatedUser = { profileId: 'user-123', isOnline: true };
      User.findOneAndUpdate.mockResolvedValue(mockUpdatedUser);

      const result = await userRepository.updateUser('user-123', updateData);

      expect(result).toEqual(mockUpdatedUser);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { profileId: 'user-123' },
        updateData,
        { new: true }
      );
    });
  });

  describe('searchUsersByUsername', () => {
    it('should search users by username', async () => {
      const mockUsers = [
        { username: 'testuser1', profileId: 'user-1' },
        { username: 'testuser2', profileId: 'user-2' }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers)
      };

      User.find.mockReturnValue(mockQuery);

      const result = await userRepository.searchUsersByUsername('test', 'exclude-123', 10);

      expect(User.find).toHaveBeenCalledWith({
        username: { $regex: 'test', $options: 'i' },
        profileId: { $ne: 'exclude-123' }
      });
    });
  });
});

