/**
 * Test Setup
 * Global test configuration and mocks
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/sparrow-test';
process.env.SESSION_SECRET = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';

// Mock AWS KMS to avoid actual AWS calls during tests
jest.mock('aws-sdk', () => {
  const mockKMS = {
    describeKey: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        KeyMetadata: {
          KeyId: 'test-key-id',
          KeyState: 'Enabled'
        }
      })
    }),
    encrypt: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        CiphertextBlob: Buffer.from('encrypted-data'),
        KeyId: 'test-key-id'
      })
    }),
    decrypt: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Plaintext: Buffer.from('decrypted-data')
      })
    })
  };

  return {
    KMS: jest.fn(() => mockKMS)
  };
});

// Increase timeout for async operations
jest.setTimeout(10000);

// Suppress console logs during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

