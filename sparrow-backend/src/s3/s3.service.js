const s3Repository = require('./s3.repository');
const s3Utils = require('./s3.utils');

/**
 * S3 Service
 * High-level S3 operations for profile pictures
 */

/**
 * Handle file upload to S3
 * @param {Object} imageFile - Multer file object with buffer, mimetype, etc.
 * @param {string} profileId - User's profile ID
 * @returns {Promise<string>} S3 URL of uploaded file
 */
async function handleUpload(imageFile, profileId) {
  if (!imageFile || !imageFile.buffer) {
    throw new Error('Image file is required');
  }

  if (!profileId) {
    throw new Error('Profile ID is required');
  }

  // Validate image type
  if (!s3Utils.validateImageType(imageFile.mimetype)) {
    throw new Error('Invalid image type. Only JPG, JPEG, and PNG are allowed');
  }

  // Validate file size (5MB max)
  if (!s3Utils.validateFileSize(imageFile.size, 5)) {
    throw new Error('File size exceeds 5MB limit');
  }

  // Generate file name
  const extension = s3Utils.getExtensionFromMimeType(imageFile.mimetype);
  const fileName = s3Utils.getFileName(profileId, extension);

  // Upload to S3
  const s3Url = await s3Repository.uploadFileToS3(
    imageFile.buffer,
    fileName,
    imageFile.mimetype
  );

  return s3Url;
}

/**
 * Handle file deletion from S3
 * @param {string} existingUrl - Existing S3 URL to delete
 * @returns {Promise<void>}
 */
async function handleDelete(existingUrl) {
  if (!existingUrl || typeof existingUrl !== 'string' || existingUrl.trim() === '') {
    // No existing image to delete
    return;
  }

  // Extract key from URL
  const key = s3Utils.extractKeyFromUrl(existingUrl);
  
  if (!key) {
    console.warn('⚠️  Could not extract S3 key from URL:', existingUrl);
    return;
  }

  // Only delete if it's from our S3 bucket
  if (!existingUrl.includes('sparrow-profile-pictures')) {
    console.warn('⚠️  URL is not from sparrow-profile-pictures bucket:', existingUrl);
    return;
  }

  try {
    await s3Repository.deleteFileFromS3(key);
  } catch (error) {
    // Log error but don't throw - deletion failure shouldn't block new upload
    console.error('⚠️  Failed to delete old profile picture:', error.message);
  }
}

module.exports = {
  handleUpload,
  handleDelete
};

