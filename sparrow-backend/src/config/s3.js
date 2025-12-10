// dotenv is loaded in app.js (entry point)

/**
 * AWS S3 Configuration
 * Configures S3 client for profile picture storage
 * 
 * Uses AWS credential provider chain:
 * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 2. AWS credentials file (~/.aws/credentials)
 * 3. IAM role (in production/EC2/ECS/Lambda)
 * 4. Other credential sources
 * 
 * Note: S3 uses its own region (AWS_S3_REGION) separate from KMS region
 */

const s3Config = {
  region: process.env.AWS_S3_REGION || 'ap-south-1',
  bucketName: process.env.AWS_S3_BUCKET_NAME || 'sparrow-profile-pictures',
  // S3 URL format: https://{bucket}.s3.{region}.amazonaws.com/{key}
  getBaseUrl: () => {
    const region = s3Config.region;
    const bucket = s3Config.bucketName;
    return `https://${bucket}.s3.${region}.amazonaws.com`;
  }
};

// Log configuration (without sensitive data)
console.log('📦 S3 Configuration:');
console.log(`   Region: ${s3Config.region} (Mumbai - ap-south-1)`);
console.log(`   Bucket: ${s3Config.bucketName}`);
console.log(`   Credentials: Using AWS credential provider chain (env vars → ~/.aws/credentials → IAM role)`);

module.exports = s3Config;

