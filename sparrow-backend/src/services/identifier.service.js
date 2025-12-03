/**
 * Identifier Service
 * Handles parsing and normalization of email, phone, and identifier fields
 */

/**
 * Parse and normalize identifier, email, and phone from request body
 * @param {Object} body - Request body containing identifier, email, phoneNumber
 * @returns {Object} Normalized identifier values
 */
function parseIdentifier(body) {
  const { identifier, email, phoneNumber } = body;
  
  const idRaw = typeof identifier === 'string' ? identifier.trim() : undefined;
  const emailRaw = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
  const phoneRaw = typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined;
  
  let emailNormalized = emailRaw;
  let phoneNormalized = phoneRaw;
  
  // If identifier is provided and no email/phone, try to parse it
  if (!emailNormalized && !phoneNormalized && idRaw) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(idRaw.toLowerCase())) {
      emailNormalized = idRaw.toLowerCase();
    } else {
      phoneNormalized = idRaw;
    }
  }
  
  return {
    identifierValue: idRaw || emailRaw || phoneRaw,
    emailNormalized,
    phoneNormalized,
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
  const hasValidPhone = phoneNumber && typeof phoneNumber === 'string' && phoneNumber.trim().length > 0;
  const hasValidPassword = password && typeof password === 'string' && password.trim().length > 0;
  
  const isValid = hasValidPassword && (hasValidIdentifier || hasValidEmail || hasValidPhone);
  
  return {
    isValid,
    hasValidIdentifier,
    hasValidEmail,
    hasValidPhone,
    hasValidPassword
  };
}

module.exports = {
  parseIdentifier,
  validateLoginCredentials
};

