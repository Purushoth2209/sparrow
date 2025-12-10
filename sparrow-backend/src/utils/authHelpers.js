/**
 * Auth Helper Utilities
 * Shared helper functions for authentication controllers
 */

const environment = require('../constants/environment');

/**
 * Parse and normalize identifier, email, and phone from request body
 * @param {Object} body - Request body
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

/**
 * Persist user session
 * @param {Object} req - Express request object
 * @param {Object} user - User object to store in session
 * @returns {Promise<void>}
 */
function persistSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.user = user;
    req.session.touch();
    req.session.save((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Set session cookie for login
 * @param {Object} res - Express response object
 * @param {string} sessionID - Session ID
 */
function setSessionCookie(res, sessionID) {
  res.clearCookie('sparrow.sid');
  res.cookie('sparrow.sid', sessionID, {
    httpOnly: true,
    secure: process.env.NODE_ENV === environment.PRODUCTION,
    sameSite: process.env.NODE_ENV === environment.PRODUCTION ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Clear session cookies
 * @param {Object} res - Express response object
 */
function clearSessionCookies(res) {
  res.clearCookie('connect.sid');
  res.clearCookie('sparrow.sid');
}

/**
 * Build user session object from user data
 * @param {Object} user - User object from service
 * @returns {Object} Session user object
 */
function buildSessionUser(user) {
  return {
    profileId: user.profileId,
    username: user.username,
    email: user.email,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
    profileImage: user.profileImage,
  };
}

module.exports = {
  parseIdentifier,
  validateLoginCredentials,
  persistSession,
  setSessionCookie,
  clearSessionCookies,
  buildSessionUser
};

