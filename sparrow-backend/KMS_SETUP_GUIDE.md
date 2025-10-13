# AWS KMS Setup Guide for Sparrow Chat Encryption

This guide walks you through setting up AWS KMS for envelope encryption in your Sparrow chat application.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured (optional, but recommended)
- Your application deployed on AWS Elastic Beanstalk

## Step 1: Create KMS Key

### Option A: Using AWS Console

1. **Navigate to AWS KMS Console**
   - Go to AWS Console → Services → KMS
   - Click "Create key"

2. **Configure Key Type**
   - Select "Symmetric"
   - Select "Encrypt and decrypt"
   - Click "Next"

3. **Add Key Alias**
   - Key alias: `sparrow-kek`
   - Description: "Sparrow Chat Message Encryption Key"
   - Click "Next"

4. **Define Key Administrative Permissions**
   - Add your AWS user/role as key administrator
   - Add your EB service role as key administrator
   - Click "Next"

5. **Define Key Usage Permissions**
   - Add your EB service role for encryption/decryption
   - Add any other roles that need access
   - Click "Next"

6. **Review and Create**
   - Review all settings
   - Click "Create key"

### Option B: Using AWS CLI

```bash
# Create the KMS key
aws kms create-key \
    --description "Sparrow Chat Message Encryption Key" \
    --key-usage ENCRYPT_DECRYPT \
    --key-spec SYMMETRIC_DEFAULT

# Create alias for the key
aws kms create-alias \
    --alias-name alias/sparrow-kek \
    --target-key-id <KEY_ID_FROM_PREVIOUS_COMMAND>
```

## Step 2: Configure IAM Permissions

### For Elastic Beanstalk Service Role

Your EB service role needs the following KMS permissions:

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
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:CreateGrant",
                "kms:RetireGrant",
                "kms:RevokeGrant"
            ],
            "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID",
            "Condition": {
                "StringEquals": {
                    "kms:ViaService": "elasticbeanstalk.REGION.amazonaws.com"
                }
            }
        }
    ]
}
```

### For Development/Testing

If you're testing locally, add these permissions to your IAM user:

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

## Step 3: Environment Configuration

### For Elastic Beanstalk

1. **Add Environment Variables**
   - Go to EB Console → Your Environment → Configuration → Software
   - Add environment variable:
     - Name: `AWS_REGION`
     - Value: `us-east-1` (or your region)

2. **Update IAM Role**
   - Ensure your EB service role has KMS permissions
   - Attach the policy from Step 2

### For Local Development

1. **Create .env file**
   ```bash
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   ```

2. **Or use AWS CLI configuration**
   ```bash
   aws configure
   ```

## Step 4: Test KMS Access

### Test Script

Create a test file to verify KMS access:

```javascript
// test-kms.js
const AWS = require('aws-sdk');

const kms = new AWS.KMS({
  region: process.env.AWS_REGION || 'us-east-1'
});

async function testKMSAccess() {
  try {
    // Test key access
    const result = await kms.describeKey({ KeyId: 'alias/sparrow-kek' }).promise();
    console.log('✅ KMS key access successful:', result.KeyMetadata.KeyId);
    
    // Test encryption
    const encryptResult = await kms.encrypt({
      KeyId: 'alias/sparrow-kek',
      Plaintext: 'test message'
    }).promise();
    console.log('✅ KMS encryption successful');
    
    // Test decryption
    const decryptResult = await kms.decrypt({
      CiphertextBlob: encryptResult.CiphertextBlob
    }).promise();
    console.log('✅ KMS decryption successful:', decryptResult.Plaintext.toString());
    
  } catch (error) {
    console.error('❌ KMS test failed:', error.message);
  }
}

testKMSAccess();
```

Run the test:
```bash
node test-kms.js
```

## Step 5: Deploy and Test

### 1. Install Dependencies
```bash
npm install aws-sdk
```

### 2. Update Your Application
- Use the KMS encryption module
- Update message handling to use encryption
- Test with a few messages

### 3. Monitor KMS Usage
- Check CloudWatch metrics for KMS usage
- Monitor costs in AWS Billing
- Set up alerts for unusual activity

## Step 6: Production Considerations

### Key Rotation
- Enable automatic key rotation in KMS console
- Test key rotation with your application
- Ensure backward compatibility

### Monitoring
- Set up CloudWatch alarms for KMS errors
- Monitor encryption/decryption success rates
- Track KMS API usage and costs

### Security
- Regularly review KMS key policies
- Monitor CloudTrail logs for KMS access
- Implement least privilege access

### Backup
- Ensure KMS key is backed up
- Test key recovery procedures
- Document key management procedures

## Troubleshooting

### Common Issues

1. **Access Denied**
   - Check IAM permissions
   - Verify key policy
   - Ensure correct region

2. **Key Not Found**
   - Verify alias name: `alias/sparrow-kek`
   - Check key exists in correct region
   - Ensure key is enabled

3. **Encryption Context Mismatch**
   - Use same context for encrypt/decrypt
   - Check context format and values

### Debug Commands

```bash
# List KMS keys
aws kms list-keys

# Describe specific key
aws kms describe-key --key-id alias/sparrow-kek

# List aliases
aws kms list-aliases

# Test encryption
aws kms encrypt --key-id alias/sparrow-kek --plaintext "test message"
```

## Cost Estimation

### KMS Costs (approximate)
- **Key Storage**: $1/month per key
- **API Calls**: $0.03 per 10,000 requests
- **Data Key Requests**: $0.03 per 10,000 requests

### For Sparrow Chat
- **Estimated Monthly Cost**: $2-5
- **Factors**: Number of messages, key rotation frequency

## Next Steps

1. **Implement Encryption**: Use the provided KMS module
2. **Test Thoroughly**: Test encryption/decryption with various message types
3. **Monitor Performance**: Track encryption overhead
4. **Plan Migration**: Migrate existing messages to encrypted format
5. **Set Up Monitoring**: Configure alerts and monitoring

## Support

If you encounter issues:
1. Check AWS KMS documentation
2. Review CloudTrail logs
3. Test with AWS CLI
4. Contact AWS support if needed

Remember: KMS is a managed service, so AWS handles the underlying security and compliance requirements for you!

