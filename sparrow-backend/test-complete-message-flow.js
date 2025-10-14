const Message = require('./models/Message');
const User = require('./models/User');
const KMSEnvelopeEncryption = require('./utils/kmsEncryption');

// Test the complete message sending flow
async function testCompleteMessageFlow() {
  try {
    console.log('🧪 Testing complete message flow...');
    
    // Step 1: Check if we have users
    const users = await User.find({}).limit(2);
    console.log('✅ Users found:', users.length);
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users to test message sending');
      return;
    }
    
    const sender = users[0];
    const receiver = users[1];
    
    console.log('Sender:', sender.profileId, sender.username);
    console.log('Receiver:', receiver.profileId, receiver.username);
    
    // Step 2: Check if they are friends
    if (!sender.friends.includes(receiver.profileId)) {
      console.log('❌ Users are not friends, adding friendship...');
      sender.friends.push(receiver.profileId);
      receiver.friends.push(sender.profileId);
      await sender.save();
      await receiver.save();
      console.log('✅ Friendship added');
    } else {
      console.log('✅ Users are already friends');
    }
    
    // Step 3: Test message sending
    console.log('📤 Testing message sending...');
    const encryptionService = new KMSEnvelopeEncryption();
    const testContent = 'Test message from debug script';
    
    const encryptedPackage = await encryptionService.encryptMessageComplete(testContent);
    console.log('✅ Message encrypted');
    
    // Step 4: Create message in database
    const message = new Message({
      senderId: sender.profileId,
      receiverId: receiver.profileId,
      isEncrypted: true,
      encryptedContent: encryptedPackage.encryptedContent,
      iv: encryptedPackage.iv,
      authTag: encryptedPackage.authTag,
      algorithm: encryptedPackage.algorithm,
      encryptedDEK: encryptedPackage.encryptedDEK,
      keyId: encryptedPackage.keyId,
      encryptionContext: encryptedPackage.encryptionContext,
      encryptionVersion: encryptedPackage.version,
      timestamp: new Date(),
      status: 'sent'
    });
    
    const savedMessage = await message.save();
    console.log('✅ Message saved to database:', savedMessage._id);
    
    // Step 5: Test decryption
    const decryptedContent = await encryptionService.decryptMessageComplete({
      encryptedContent: savedMessage.encryptedContent,
      iv: savedMessage.iv,
      authTag: savedMessage.authTag,
      algorithm: savedMessage.algorithm,
      encryptedDEK: savedMessage.encryptedDEK,
      keyId: savedMessage.keyId,
      encryptionContext: savedMessage.encryptionContext
    });
    
    console.log('✅ Message decrypted successfully');
    console.log('Original:', testContent);
    console.log('Decrypted:', decryptedContent);
    
    // Step 6: Check message count
    const messageCount = await Message.countDocuments();
    console.log('📊 Total messages in database:', messageCount);
    
    console.log('🎉 Complete message flow test passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testCompleteMessageFlow().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
