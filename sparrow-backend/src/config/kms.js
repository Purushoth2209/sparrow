// dotenv is loaded in app.js (entry point)

/**
 * KMS Configuration
 * AWS KMS key configuration for encryption
 * 
 * Uses AWS credential provider chain:
 * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 2. AWS credentials file (~/.aws/credentials)
 * 3. IAM role (in production/EC2/ECS/Lambda)
 * 4. Other credential sources
 * 
 * Note: KMS uses its own region (AWS_REGION) separate from S3 region
 */

const kmsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  keyId: process.env.AWS_KMS_KEY_ID,
  // Additional KMS configuration can be added here
};

// Log configuration (without sensitive data)
console.log('🔐 KMS Configuration:');
console.log(`   Region: ${kmsConfig.region} (us-east-1)`);
if (kmsConfig.keyId) {
  console.log(`   Key ID: ${kmsConfig.keyId.substring(0, 20)}...`);
} else {
  console.log(`   Key ID: Not configured (set AWS_KMS_KEY_ID in .env)`);
}
console.log(`   Credentials: Using AWS credential provider chain (env vars → ~/.aws/credentials → IAM role)`);

module.exports = kmsConfig;

