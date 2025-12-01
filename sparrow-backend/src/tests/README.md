# Unit Tests

This directory contains unit tests for the Sparrow backend services and repositories.

## Test Structure

```
tests/
├── auth.service.test.js          # Authentication service tests
├── message.service.test.js        # Message service tests
├── friend.service.test.js         # Friend service tests
├── user.service.test.js           # User service tests
├── repositories/                  # Repository tests
│   ├── user.repository.test.js
│   └── message.repository.test.js
├── setup.js                       # Test configuration
└── README.md                      # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run tests with coverage
npm test -- --coverage
```

## Test Coverage

The tests cover:

### Auth Service
- ✅ Username availability checking
- ✅ Password validation (strength requirements)
- ✅ Email validation (format and MX records)
- ✅ User registration
- ✅ User login (email, phone, username)
- ✅ Account lockout after failed attempts
- ✅ Password expiry warnings
- ✅ Username setting for Google OAuth users

### Message Service
- ✅ Sending messages (with encryption)
- ✅ Decrypting messages
- ✅ Batch message sending
- ✅ Retrieving messages
- ✅ Marking messages as read
- ✅ Encryption statistics

### Friend Service
- ✅ Global user search
- ✅ Friend search
- ✅ Sending friend requests
- ✅ Accepting/rejecting friend requests
- ✅ Getting friends list
- ✅ Removing friends

### User Service
- ✅ Getting current user data

### Repositories
- ✅ User repository operations
- ✅ Message repository operations

## Writing New Tests

When adding new functionality:

1. Create a test file: `src/tests/[service-name].test.js`
2. Mock external dependencies (database, AWS, etc.)
3. Test both success and error cases
4. Test edge cases and validation
5. Ensure tests are isolated and independent

## Mocking Guidelines

- **Repositories**: Always mock repository calls
- **External Services**: Mock AWS KMS, DNS, OIDC clients
- **Database**: Mock Mongoose models
- **Encryption**: Mock encryption service for faster tests

## Example Test Structure

```javascript
const service = require('../services/example.service');
const repository = require('../repositories/example.repository');

jest.mock('../repositories/example.repository');

describe('Example Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('functionName', () => {
    it('should do something successfully', async () => {
      // Arrange
      repository.find.mockResolvedValue(mockData);

      // Act
      const result = await service.functionName(params);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(repository.find).toHaveBeenCalledWith(params);
    });

    it('should throw error when something fails', async () => {
      repository.find.mockResolvedValue(null);

      await expect(service.functionName(params)).rejects.toThrow('Error message');
    });
  });
});
```

