/**
 * UUID Utility
 * 
 * Generates UUID v4 identifiers for temporary message IDs.
 * Uses crypto.randomUUID() if available, otherwise falls back to a manual implementation.
 */

/**
 * Generate a UUID v4
 * @returns {string} UUID v4 string
 */
export const generateUUID = () => {
  // Use native crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: Manual UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Generate a temporary ID for messages (UUID format)
 * @returns {string} Temporary ID
 */
export const generateTempId = () => {
  return generateUUID();
};

