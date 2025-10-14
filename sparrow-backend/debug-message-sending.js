const Message = require('./models/Message');
const User = require('./models/User');
const KMSEnvelopeEncryption = require('./utils/kmsEncryption');

// Test function to debug message sending
async function testMessageSending() {
  try {
    console.log('🧪 Testing message sending...');
    
    // Test 1: Check if encryption service initializes
    console.log('1. Testing encryption service initialization...');
    const encryptionService = new KMSEnvelopeEncryption();
    console.log('✅ Encryption service initialized');
    
    // Test 2: Check if we can encrypt a message
    console.log('2. Testing message encryption...');
    const testContent = 'Hello, this is a test message';
    const encryptedPackage = await encryptionService.encryptMessageComplete(testContent);
    console.log('✅ Message encrypted successfully');
    console.log('Encrypted package keys:', Object.keys(encryptedPackage));
    
    // Test 3: Check if we can decrypt the message
    console.log('3. Testing message decryption...');
    const decryptedContent = await encryptionService.decryptMessageComplete(encryptedPackage);
    console.log('✅ Message decrypted successfully');
    console.log('Original:', testContent);
    console.log('Decrypted:', decryptedContent);
    
    // Test 4: Check if users exist
    console.log('4. Testing user lookup...');
    const users = await User.find({}).limit(2);
    console.log('✅ Users found:', users.length);
    if (users.length >= 2) {
      console.log('User 1:', users[0].profileId, users[0].username);
      console.log('User 2:', users[1].profileId, users[1].username);
    }
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testMessageSending().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
