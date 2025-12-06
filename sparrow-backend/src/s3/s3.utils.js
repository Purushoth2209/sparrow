/**
 * S3 Utilities
 * Helper functions for S3 operations
 */

/**
 * Generate file name for profile picture
 * Format: {profileId}-{timestamp}.jpg
 * @param {string} profileId - User's profile ID
 * @param {string} originalExtension - Original file extension (e.g., 'jpg', 'png')
 * @returns {string} Generated file name
 */
function getFileName(profileId, originalExtension) {
  const timestamp = Date.now();
  // Normalize extension to lowercase and ensure it's valid
  const ext = originalExtension ? originalExtension.toLowerCase().replace('.', '') : 'jpg';
  // Always use .jpg extension as per requirements
  return `${profileId}-${timestamp}.jpg`;
}

/**
 * Extract S3 key from URL
 * Example: https://sparrow-profile-pictures.s3.ap-south-1.amazonaws.com/user-123-1234567890.jpg
 * Returns: user-123-1234567890.jpg
 * @param {string} url - Full S3 URL
 * @returns {string|null} S3 key or null if invalid
 */
function extractKeyFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Extract key from S3 URL
    // Pattern: https://bucket.s3.region.amazonaws.com/key
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Remove leading slash
    const key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
    
    return key || null;
  } catch (error) {
    // If URL parsing fails, try to extract from common patterns
    const s3Pattern = /s3\.[^/]+\.amazonaws\.com\/(.+)$/;
    const match = url.match(s3Pattern);
    return match ? match[1] : null;
  }
}

/**
 * Validate image MIME type
 * Accepts only: image/jpeg, image/jpg, image/png
 * @param {string} mimeType - MIME type to validate
 * @returns {boolean} True if valid image type
 */
function validateImageType(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') {
    return false;
  }

  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  return validTypes.includes(mimeType.toLowerCase());
}

/**
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} File extension (jpg, png)
 */
function getExtensionFromMimeType(mimeType) {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png'
  };

  return mimeMap[mimeType?.toLowerCase()] || 'jpg';
}

/**
 * Validate file size (optional helper)
 * @param {number} sizeInBytes - File size in bytes
 * @param {number} maxSizeInMB - Maximum size in MB (default: 5MB)
 * @returns {boolean} True if size is valid
 */
function validateFileSize(sizeInBytes, maxSizeInMB = 5) {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return sizeInBytes <= maxSizeInBytes;
}

module.exports = {
  getFileName,
  extractKeyFromUrl,
  validateImageType,
  getExtensionFromMimeType,
  validateFileSize
};

