const authService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');
const authRepository = require('../repositories/auth.repository');
const bcrypt = require('bcryptjs');

// Mock dependencies
jest.mock('../repositories/user.repository');
jest.mock('../repositories/auth.repository');
jest.mock('bcryptjs');
jest.mock('../config/oidcClients');
jest.mock('../utils/tokenVerifier');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkUsernameAvailability', () => {
    it('should return available when username does not exist', async () => {
      userRepository.findUserByUsername.mockResolvedValue(null);

      const result = await authService.checkUsernameAvailability('newuser');

      expect(result.available).toBe(true);
      expect(result.message).toBe('Username is available');
      expect(userRepository.findUserByUsername).toHaveBeenCalledWith('newuser');
    });

    it('should return unavailable when username exists', async () => {
      userRepository.findUserByUsername.mockResolvedValue({ username: 'existinguser' });

      const result = await authService.checkUsernameAvailability('existinguser');

      expect(result.available).toBe(false);
      expect(result.message).toBe('Username is taken');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle invalid username input', async () => {
      const result = await authService.checkUsernameAvailability(null);

      expect(result.available).toBe(false);
      expect(result.message).toBe('Username is required');
    });
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = authService.validatePassword('StrongPass123!');

      expect(result.valid).toBe(true);
    });

    it('should reject weak password (too short)', () => {
      const result = authService.validatePassword('Short1!');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('8+ chars');
    });

    it('should reject password without uppercase', () => {
      const result = authService.validatePassword('lowercase123!');

      expect(result.valid).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const result = authService.validatePassword('UPPERCASE123!');

      expect(result.valid).toBe(false);
    });

    it('should reject password without number', () => {
      const result = authService.validatePassword('NoNumber!');

      expect(result.valid).toBe(false);
    });

    it('should reject password without special character', () => {
      const result = authService.validatePassword('NoSpecial123');

      expect(result.valid).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email format', async () => {
      const dns = require('dns').promises;
      jest.spyOn(dns, 'resolveMx').mockResolvedValue([{ exchange: 'mail.example.com' }]);

      const result = await authService.validateEmail('test@example.com');

      expect(result.valid).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const result = await authService.validateEmail('invalid-email');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid email format');
    });

    it('should reject email with invalid domain', async () => {
      const dns = require('dns').promises;
      jest.spyOn(dns, 'resolveMx').mockRejectedValue(new Error('No MX records'));

      const result = await authService.validateEmail('test@invalid-domain-xyz.com');

      expect(result.valid).toBe(false);
    });
  });

  describe('registerUser', () => {
    const mockUserData = {
      email: 'test@example.com',
      phoneNumber: '+1234567890',
      password: 'StrongPass123!',
      username: 'testuser',
      fullName: 'Test User'
    };

    it('should successfully register a new user', async () => {
      userRepository.findUserByEmailOrPhoneOrUsername.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedPassword');
      userRepository.createUser.mockResolvedValue({
        profileId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        fullName: 'Test User',
        profileImage: ''
      });

      const result = await authService.registerUser(mockUserData);

      expect(result.profileId).toBe('user-123');
      expect(result.username).toBe('testuser');
      expect(userRepository.createUser).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123!', 10);
    });

    it('should throw error if email already exists', async () => {
      userRepository.findUserByEmailOrPhoneOrUsername.mockResolvedValue({
        email: 'test@example.com'
      });

      await expect(authService.registerUser(mockUserData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should throw error if username already exists', async () => {
      userRepository.findUserByEmailOrPhoneOrUsername.mockResolvedValue({
        username: 'testuser'
      });

      await expect(authService.registerUser(mockUserData)).rejects.toThrow(
        'User with this username already exists'
      );
    });
  });

  describe('loginUser', () => {
    const mockUser = {
      profileId: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedPassword',
      loginAttempts: 0,
      lockUntil: null,
      passwordChangedAt: new Date(),
      save: jest.fn()
    };

    it('should successfully login with email', async () => {
      authRepository.findUserForLogin.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      authRepository.resetLoginAttempts.mockResolvedValue(mockUser);

      const result = await authService.loginUser(null, 'test@example.com', null, 'password123', null);

      expect(result.profileId).toBe('user-123');
      expect(result.username).toBe('testuser');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(authRepository.resetLoginAttempts).toHaveBeenCalled();
    });

    it('should successfully login with username', async () => {
      authRepository.findUserForLogin.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      authRepository.resetLoginAttempts.mockResolvedValue(mockUser);

      const result = await authService.loginUser('testuser', null, null, 'password123', null);

      expect(result.profileId).toBe('user-123');
    });

    it('should throw error for invalid credentials', async () => {
      authRepository.findUserForLogin.mockResolvedValue(null);

      await expect(
        authService.loginUser(null, 'wrong@example.com', null, 'password123', null)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for wrong password', async () => {
      authRepository.findUserForLogin.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);
      mockUser.save.mockResolvedValue(mockUser);

      await expect(
        authService.loginUser(null, 'test@example.com', null, 'wrongpassword', null)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should lock account after max login attempts', async () => {
      const lockedUser = {
        ...mockUser,
        loginAttempts: 4
      };
      authRepository.findUserForLogin.mockResolvedValue(lockedUser);
      bcrypt.compare.mockResolvedValue(false);
      lockedUser.save.mockResolvedValue(lockedUser);

      await expect(
        authService.loginUser(null, 'test@example.com', null, 'wrongpassword', null)
      ).rejects.toThrow('Account locked');
    });

    it('should throw error if account is already locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockUntil: new Date(Date.now() + 15 * 60 * 1000)
      };
      authRepository.findUserForLogin.mockResolvedValue(lockedUser);

      await expect(
        authService.loginUser(null, 'test@example.com', null, 'password123', null)
      ).rejects.toThrow('Account is locked');
    });

    it('should return password warning for old password', async () => {
      const oldPasswordUser = {
        ...mockUser,
        passwordChangedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100 days ago
      };
      authRepository.findUserForLogin.mockResolvedValue(oldPasswordUser);
      bcrypt.compare.mockResolvedValue(true);
      authRepository.resetLoginAttempts.mockResolvedValue(oldPasswordUser);

      const result = await authService.loginUser(null, 'test@example.com', null, 'password123', null);

      expect(result.passwordWarning).toContain('90 days old');
    });
  });

  describe('setUsername', () => {
    it('should successfully set username', async () => {
      const mockUser = {
        profileId: 'user-123',
        username: 'oldusername',
        needsUsernameSetup: true,
        save: jest.fn()
      };

      userRepository.findUserByUsername.mockResolvedValue(null);
      userRepository.findUserByProfileId.mockResolvedValue(mockUser);
      mockUser.save.mockResolvedValue({
        ...mockUser,
        username: 'newusername',
        needsUsernameSetup: false
      });

      const result = await authService.setUsername('user-123', 'newusername');

      expect(result.username).toBe('newusername');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error if username is taken', async () => {
      userRepository.findUserByUsername.mockResolvedValue({ username: 'taken' });

      await expect(authService.setUsername('user-123', 'taken')).rejects.toThrow(
        'Username is already taken'
      );
    });

    it('should throw error if user not found', async () => {
      userRepository.findUserByUsername.mockResolvedValue(null);
      userRepository.findUserByProfileId.mockResolvedValue(null);

      await expect(authService.setUsername('invalid-id', 'newusername')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('generateUsernameSuggestions', () => {
    it('should generate suggestions for taken username', () => {
      const suggestions = authService.generateUsernameSuggestions('testuser');

      expect(suggestions.length).toBe(5);
      expect(suggestions.every(s => typeof s === 'string')).toBe(true);
    });

    it('should return empty array for invalid input', () => {
      const suggestions = authService.generateUsernameSuggestions('');

      expect(suggestions.length).toBe(0);
    });
  });
});

