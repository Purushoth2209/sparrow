# KMS Encryption Integration - Deployment Guide

This guide walks you through deploying the KMS envelope encryption integration to your Sparrow chat application.

## 🚀 Pre-Deployment Checklist

### 1. AWS KMS Setup
- [ ] KMS key created with alias `alias/sparrow-kek`
- [ ] IAM permissions configured for EB service role
- [ ] KMS key is enabled and accessible
- [ ] Test KMS access with provided test script

### 2. Dependencies
- [ ] AWS SDK added to package.json
- [ ] All encryption modules created
- [ ] Database models updated

### 3. Environment Configuration
- [ ] AWS_REGION environment variable set
- [ ] MongoDB connection string configured
- [ ] All environment variables properly set

## 📋 Deployment Steps

### Step 1: Install Dependencies

```bash
# Install AWS SDK
npm install aws-sdk

# Verify installation
npm list aws-sdk
```

### Step 2: Deploy to Elastic Beanstalk

```bash
# Commit all changes
git add .
git commit -m "Add KMS envelope encryption integration"

# Deploy to EB
eb deploy
```

### Step 3: Verify Deployment

```bash
# Check EB logs for any errors
eb logs

# Test KMS access
curl -X GET https://your-app-url/api/messages/stats/encryption \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 4: Run Integration Tests

```bash
# Run the encryption test suite
node test-encryption.js
```

Expected output:
```
🚀 Starting KMS Encryption Integration Tests
✅ Connected to MongoDB
🧪 Running test: KMS Service Initialization
✅ KMS Service Initialization: PASSED
...
📊 Test Results Summary:
✅ Passed: 7
❌ Failed: 0
📈 Success Rate: 100.0%
```

## 🔧 Configuration Details

### AWS KMS Configuration

**Key Settings:**
- **Key Type:** Symmetric
- **Key Usage:** Encrypt and Decrypt
- **Key Alias:** `alias/sparrow-kek`
- **Key Rotation:** Enabled (recommended)

**IAM Permissions Required:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "kms:Encrypt",
                "kms:Decrypt",
                "kms:ReEncrypt*",
                "kms:GenerateDataKey*",
                "kms:DescribeKey"
            ],
            "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"
        }
    ]
}
```

### Environment Variables

**Required Variables:**
```bash
AWS_REGION=us-east-1
MONGO_URI=mongodb://your-mongo-connection
SESSION_SECRET=your-session-secret
```

**Optional Variables:**
```bash
NODE_ENV=production
LOG_LEVEL=info
```

## 📊 Monitoring & Verification

### 1. Check Encryption Statistics

**API Endpoint:** `GET /api/messages/stats/encryption`

**Expected Response:**
```json
{
  "message": "Encryption statistics retrieved successfully",
  "stats": {
    "total": 100,
    "encrypted": 100,
    "plainText": 0,
    "encryptionPercentage": "100.00"
  }
}
```

### 2. Monitor AWS CloudWatch

**Key Metrics to Monitor:**
- KMS API calls (encrypt/decrypt operations)
- KMS errors and throttling
- Application performance metrics
- Database query performance

**CloudWatch Alarms to Set:**
- KMS API call failures
- High KMS usage (potential abuse)
- Application error rates
- Database connection issues

### 3. Test Message Flow

**Test Scenarios:**
1. Send a message via Socket.IO
2. Verify message is encrypted in database
3. Retrieve message via REST API
4. Verify message is decrypted for display
5. Test with multiple users and conversations

## 🔄 Migration Strategy

### Phase 1: Gradual Rollout (Recommended)

1. **Deploy with encryption enabled**
2. **New messages are automatically encrypted**
3. **Existing messages remain readable (backward compatibility)**
4. **Monitor performance and errors**

### Phase 2: Full Migration (Optional)

If you want to encrypt existing messages:

```javascript
// Run migration script (one-time operation)
const { MessageMigrationHelper } = require('./utils/encryptedMessageIntegration');

async function migrateExistingMessages() {
  try {
    await MessageMigrationHelper.migrateMessagesToEncrypted();
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrateExistingMessages();
```

**⚠️ Important:** 
- Backup your database before running migration
- Test migration on a copy of production data first
- Migration is a one-way operation

## 🚨 Troubleshooting

### Common Issues

**1. KMS Access Denied**
```
Error: KMS key alias/sparrow-kek is not accessible
```
**Solution:** Check IAM permissions and key policy

**2. Encryption Failures**
```
Error: Message encryption failed
```
**Solution:** Check KMS key status and AWS credentials

**3. Decryption Failures**
```
Error: Message could not be decrypted
```
**Solution:** Verify encryption context and key rotation

**4. Performance Issues**
```
Slow message sending/receiving
```
**Solution:** Monitor KMS API limits and consider caching

### Debug Commands

```bash
# Test KMS access
aws kms describe-key --key-id alias/sparrow-kek

# Check EB logs
eb logs --all

# Test encryption locally
node -e "
const KMS = require('./utils/kmsEncryption');
const kms = new KMS();
kms.encryptMessageComplete('test').then(console.log);
"
```

## 📈 Performance Expectations

### Encryption Overhead
- **Message Encryption:** ~5-10ms per message
- **Message Decryption:** ~5-10ms per message
- **Database Storage:** ~30% larger message size
- **Network Transfer:** Minimal impact

### Scalability Considerations
- **KMS API Limits:** 10,000 requests/second per key
- **Concurrent Users:** No practical limit
- **Message Volume:** Handles thousands of messages/minute

## 🔒 Security Benefits

### What's Protected
- ✅ **Message Content:** Encrypted in database
- ✅ **Data Encryption Keys:** Managed by AWS KMS
- ✅ **Key Rotation:** Automatic via AWS KMS
- ✅ **Access Control:** IAM-based permissions
- ✅ **Audit Trail:** CloudTrail logging

### What's Not Protected
- ❌ **Message Metadata:** Sender, receiver, timestamps
- ❌ **Message Status:** Sent, delivered, read status
- ❌ **User Information:** Profile data, friend lists

## 📞 Support & Maintenance

### Regular Maintenance Tasks
1. **Monitor KMS usage and costs**
2. **Review CloudWatch metrics**
3. **Check encryption statistics**
4. **Update AWS SDK periodically**
5. **Review IAM permissions**

### Emergency Procedures
1. **Disable encryption:** Set `isEncrypted: false` in new messages
2. **Rollback deployment:** Use EB rollback feature
3. **Database recovery:** Restore from backup if needed

## ✅ Post-Deployment Verification

### Checklist
- [ ] All tests pass
- [ ] Messages are being encrypted
- [ ] Messages can be decrypted
- [ ] Real-time messaging works
- [ ] API endpoints respond correctly
- [ ] No errors in logs
- [ ] Performance is acceptable
- [ ] Monitoring is set up

### Success Criteria
- **Encryption Rate:** 100% of new messages encrypted
- **Error Rate:** < 0.1% encryption/decryption failures
- **Performance:** < 50ms additional latency per message
- **Uptime:** No service interruptions

## 🎉 Congratulations!

Your Sparrow chat application now has enterprise-grade encryption! Messages are protected with AWS KMS envelope encryption, providing security similar to WhatsApp and other major messaging platforms.

**Next Steps:**
1. Monitor the system for 24-48 hours
2. Gather user feedback
3. Consider additional security features
4. Plan for key rotation and maintenance

**Remember:** Security is an ongoing process, not a one-time implementation. Regular monitoring and updates are essential for maintaining security.

