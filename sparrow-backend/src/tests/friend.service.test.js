const friendService = require('../services/friend.service');
const userRepository = require('../repositories/user.repository');
const friendRepository = require('../repositories/friend.repository');

// Mock dependencies
jest.mock('../repositories/user.repository');
jest.mock('../repositories/friend.repository');

describe('Friend Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchGlobalUsers', () => {
    it('should search users by username', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        friends: ['user-456'],
        friendRequests: []
      };

      const mockUsers = [
        {
          profileId: 'user-456',
          username: 'frienduser',
          profileImage: 'image.jpg',
          friendRequests: []
        },
        {
          profileId: 'user-789',
          username: 'newuser',
          profileImage: 'image2.jpg',
          friendRequests: []
        }
      ];

      userRepository.findUserByProfileId.mockResolvedValue(mockCurrentUser);
      userRepository.searchUsersByUsername.mockResolvedValue(mockUsers);

      const result = await friendService.searchGlobalUsers('user', 'user-123');

      expect(result.length).toBe(2);
      expect(result[0].status).toBe('already_friends');
      expect(result[1].status).toBe('send_request');
    });

    it('should throw error if username too short', async () => {
      await expect(friendService.searchGlobalUsers('a', 'user-123')).rejects.toThrow(
        'Username must be at least 2 characters long'
      );
    });

    it('should throw error if current user not found', async () => {
      userRepository.findUserByProfileId.mockResolvedValue(null);

      await expect(friendService.searchGlobalUsers('user', 'invalid-id')).rejects.toThrow(
        'Current user not found'
      );
    });
  });

  describe('searchFriends', () => {
    it('should search friends by username', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        friends: ['user-456', 'user-789']
      };

      const mockFriends = [
        {
          profileId: 'user-456',
          username: 'friend1',
          fullName: 'Friend One',
          profileImage: 'image1.jpg',
          isOnline: true,
          lastSeen: new Date()
        },
        {
          profileId: 'user-789',
          username: 'friend2',
          fullName: 'Friend Two',
          profileImage: 'image2.jpg',
          isOnline: false,
          lastSeen: new Date()
        }
      ];

      userRepository.findUserByProfileId.mockResolvedValue(mockCurrentUser);
      userRepository.findUsersByProfileIds.mockResolvedValue(mockFriends);

      const result = await friendService.searchFriends('friend', 'user-123');

      expect(result.length).toBe(2);
      expect(result[0].username).toBe('friend1');
    });

    it('should return all friends if no username filter', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        friends: ['user-456']
      };

      const mockFriends = [
        {
          profileId: 'user-456',
          username: 'friend1',
          fullName: 'Friend One',
          profileImage: 'image1.jpg',
          isOnline: true
        }
      ];

      userRepository.findUserByProfileId.mockResolvedValue(mockCurrentUser);
      userRepository.findUsersByProfileIds.mockResolvedValue(mockFriends);

      const result = await friendService.searchFriends(null, 'user-123');

      expect(result.length).toBe(1);
    });
  });

  describe('sendFriendRequest', () => {
    it('should successfully send friend request', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        username: 'currentuser',
        fullName: 'Current User',
        profileImage: 'current.jpg',
        friends: []
      };

      const mockTargetUser = {
        profileId: 'user-456',
        friendRequests: []
      };

      userRepository.findUserByProfileId
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockCurrentUser);
      friendRepository.findFriendRequest.mockResolvedValue(null);
      friendRepository.addFriendRequest.mockResolvedValue(mockTargetUser);

      const result = await friendService.sendFriendRequest('user-123', 'user-456');

      expect(result.username).toBe('currentuser');
      expect(friendRepository.addFriendRequest).toHaveBeenCalledWith('user-456', 'user-123');
    });

    it('should throw error if trying to send request to self', async () => {
      await expect(friendService.sendFriendRequest('user-123', 'user-123')).rejects.toThrow(
        'Cannot send friend request to yourself'
      );
    });

    it('should throw error if target user not found', async () => {
      userRepository.findUserByProfileId.mockResolvedValue(null);

      await expect(friendService.sendFriendRequest('user-123', 'invalid-id')).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if already friends', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        friends: ['user-456']
      };

      const mockTargetUser = {
        profileId: 'user-456'
      };

      userRepository.findUserByProfileId
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockCurrentUser);

      await expect(friendService.sendFriendRequest('user-123', 'user-456')).rejects.toThrow(
        'You are already friends with this user'
      );
    });

    it('should throw error if request already sent', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        friends: []
      };

      const mockTargetUser = {
        profileId: 'user-456'
      };

      userRepository.findUserByProfileId
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockCurrentUser);
      friendRepository.findFriendRequest.mockResolvedValue({ status: 'pending' });

      await expect(friendService.sendFriendRequest('user-123', 'user-456')).rejects.toThrow(
        'Friend request already sent to this user'
      );
    });
  });

  describe('acceptFriendRequest', () => {
    it('should successfully accept friend request', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        username: 'currentuser',
        fullName: 'Current User',
        profileImage: 'current.jpg',
        friendRequests: [{ fromUserId: 'user-456', status: 'pending' }]
      };

      const mockSenderUser = {
        profileId: 'user-456'
      };

      userRepository.findUserByProfileId
        .mockResolvedValueOnce(mockCurrentUser)
        .mockResolvedValueOnce(mockSenderUser);
      friendRepository.findFriendRequest.mockResolvedValue({ status: 'pending' });
      friendRepository.updateFriendRequestStatus.mockResolvedValue(mockCurrentUser);
      friendRepository.addFriendToUser.mockResolvedValue(mockCurrentUser);

      const result = await friendService.acceptFriendRequest('user-123', 'user-456');

      expect(result.username).toBe('currentuser');
      expect(friendRepository.updateFriendRequestStatus).toHaveBeenCalled();
      expect(friendRepository.addFriendToUser).toHaveBeenCalledTimes(2);
    });

    it('should throw error if request not found', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        friendRequests: []
      };

      userRepository.findUserByProfileId.mockResolvedValue(mockCurrentUser);
      friendRepository.findFriendRequest.mockResolvedValue(null);

      await expect(friendService.acceptFriendRequest('user-123', 'user-456')).rejects.toThrow(
        'No pending friend request found'
      );
    });
  });

  describe('rejectFriendRequest', () => {
    it('should successfully reject friend request', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        username: 'currentuser',
        fullName: 'Current User',
        profileImage: 'current.jpg'
      };

      userRepository.findUserByProfileId.mockResolvedValue(mockCurrentUser);
      friendRepository.findFriendRequest.mockResolvedValue({ status: 'pending' });
      friendRepository.removeFriendRequest.mockResolvedValue(mockCurrentUser);

      const result = await friendService.rejectFriendRequest('user-123', 'user-456');

      expect(result.username).toBe('currentuser');
      expect(friendRepository.removeFriendRequest).toHaveBeenCalled();
    });
  });

  describe('getFriends', () => {
    it('should return list of friends', async () => {
      const mockUser = {
        profileId: 'user-123',
        friends: ['user-456', 'user-789']
      };

      const mockFriends = [
        {
          profileId: 'user-456',
          username: 'friend1',
          fullName: 'Friend One',
          profileImage: 'image1.jpg',
          isOnline: true
        },
        {
          profileId: 'user-789',
          username: 'friend2',
          fullName: 'Friend Two',
          profileImage: 'image2.jpg',
          isOnline: false
        }
      ];

      userRepository.findUserByProfileId.mockResolvedValue(mockUser);
      userRepository.findUsersByProfileIds.mockResolvedValue(mockFriends);

      const result = await friendService.getFriends('user-123');

      expect(result.length).toBe(2);
      expect(result[0].username).toBe('friend1');
    });
  });

  describe('removeFriend', () => {
    it('should successfully remove friend', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        username: 'currentuser',
        fullName: 'Current User',
        profileImage: 'current.jpg',
        friends: ['user-456']
      };

      const mockFriendUser = {
        profileId: 'user-456',
        friends: ['user-123']
      };

      userRepository.findUserByProfileId
        .mockResolvedValueOnce(mockCurrentUser)
        .mockResolvedValueOnce(mockFriendUser);
      friendRepository.removeFriendFromUser.mockResolvedValue(mockCurrentUser);

      const result = await friendService.removeFriend('user-123', 'user-456');

      expect(result.username).toBe('currentuser');
      expect(friendRepository.removeFriendFromUser).toHaveBeenCalledTimes(2);
    });

    it('should throw error if trying to remove self', async () => {
      await expect(friendService.removeFriend('user-123', 'user-123')).rejects.toThrow(
        'Cannot remove yourself as a friend'
      );
    });

    it('should throw error if not friends', async () => {
      const mockCurrentUser = {
        profileId: 'user-123',
        friends: []
      };

      userRepository.findUserByProfileId.mockResolvedValue(mockCurrentUser);

      await expect(friendService.removeFriend('user-123', 'user-456')).rejects.toThrow(
        'This user is not your friend'
      );
    });
  });
});

