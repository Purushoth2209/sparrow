const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Config = require('../config/s3');

/**
 * S3 Repository
 * Direct AWS SDK v3 interactions with S3
 * 
 * Uses AWS default credential provider chain (automatic):
 * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) - if set
 * 2. AWS credentials file (~/.aws/credentials) - from `aws configure`
 * 3. IAM role - automatically in EC2/ECS/Lambda/EB environments
 * 4. Other credential sources
 * 
 * No explicit credentials needed - SDK handles this automatically
 */

// Initialize S3 client with default credential provider chain
// When credentials are not explicitly provided, AWS SDK v3 automatically
// uses the default credential provider chain which checks:
// - Environment variables
// - Shared credentials file (~/.aws/credentials)
// - IAM instance profile role (in EC2/ECS/Lambda)
// - Other credential sources
const s3Client = new S3Client({
  region: s3Config.region
  // No credentials property = uses default credential provider chain
});

/**
 * Upload file to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 object key (file path)
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} S3 URL of uploaded file
 */
async function uploadFileToS3(buffer, key, mimeType) {
  try {
    const command = new PutObjectCommand({
      Bucket: s3Config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Make the object publicly readable
      ACL: 'public-read'
    });

    await s3Client.send(command);

    // Return the public URL
    const url = `${s3Config.getBaseUrl()}/${key}`;
    return url;
  } catch (error) {
    console.error('❌ S3 Upload Error:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
}

/**
 * Delete file from S3
 * @param {string} key - S3 object key (file path)
 * @returns {Promise<void>}
 */
async function deleteFileFromS3(key) {
  try {
    // If key is a full URL, extract the key
    const s3Utils = require('./s3.utils');
    const actualKey = key.includes('amazonaws.com') 
      ? s3Utils.extractKeyFromUrl(key)
      : key;

    if (!actualKey) {
      console.warn('⚠️  Could not extract S3 key from:', key);
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: s3Config.bucketName,
      Key: actualKey
    });

    await s3Client.send(command);
    console.log(`✅ Deleted S3 file: ${actualKey}`);
  } catch (error) {
    console.error('❌ S3 Delete Error:', error);
    // Don't throw error - deletion failure shouldn't block upload
    // Log it for monitoring
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
}

module.exports = {
  uploadFileToS3,
  deleteFileFromS3
};

