/**
 * Identifier Service
 * Handles parsing and normalization of email and identifier fields
 * Phone number support removed - only email and username supported
 */

/**
 * Parse and normalize identifier and email from request body
 * @param {Object} body - Request body containing identifier, email
 * @returns {Object} Normalized identifier values
 */
function parseIdentifier(body) {
  const { identifier, email, phoneNumber } = body;
  
  const idRaw = typeof identifier === 'string' ? identifier.trim() : undefined;
  const emailRaw = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
  const phoneRaw = typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined;
  
  let emailNormalized = emailRaw;
  let phoneNormalized = phoneRaw; // Kept for backward compatibility with existing users only
  
  // If identifier is provided and no email, try to parse it
  // Can be email or username (phone removed from new registrations)
  if (!emailNormalized && idRaw) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(idRaw.toLowerCase())) {
      emailNormalized = idRaw.toLowerCase();
    }
    // If not email, treat as username (phone removed)
  }
  
  return {
    identifierValue: idRaw || emailRaw || phoneRaw,
    emailNormalized,
    phoneNormalized, // Only for existing users who registered with phone
    emailRaw,
    phoneRaw
  };
}

/**
 * Validate login credentials presence
 * @param {Object} body - Request body
 * @returns {Object} Validation result
 */
function validateLoginCredentials(body) {
  const { identifier, email, phoneNumber, password } = body;
  
  const hasValidIdentifier = identifier && typeof identifier === 'string' && identifier.trim().length > 0;
  const hasValidEmail = email && typeof email === 'string' && email.trim().length > 0;
  const hasValidPhone = phoneNumber && typeof phoneNumber === 'string' && phoneNumber.trim().length > 0; // For existing users only
  const hasValidPassword = password && typeof password === 'string' && password.trim().length > 0;
  
  const isValid = hasValidPassword && (hasValidIdentifier || hasValidEmail || hasValidPhone);
  
  return {
    isValid,
    hasValidIdentifier,
    hasValidEmail,
    hasValidPhone, // For existing users only
    hasValidPassword
  };
}

module.exports = {
  parseIdentifier,
  validateLoginCredentials
};

