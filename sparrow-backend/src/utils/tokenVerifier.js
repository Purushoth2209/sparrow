/**
 * Token Verification Utilities
 * 
 * Verifies ID tokens from OIDC providers using their public keys (JWKS).
 * The openid-client library handles most of this automatically,
 * but this module provides explicit verification helpers if needed.
 */

const { Issuer } = require('openid-client');

/**
 * Verify Google ID Token
 * 
 * This function verifies the ID token JWT signature using Google's public keys.
 * The openid-client library handles this automatically in the callback flow,
 * but this can be used for additional verification or manual token checks.
 * 
 * @param {string} idToken - The ID token (JWT) from Google
 * @param {Client} client - The OIDC client instance
 * @returns {Promise<Object>} Decoded and verified token claims
 */
async function verifyGoogleIdToken(idToken, client) {
  try {
    // The client.validateIdToken() method:
    // 1. Fetches Google's JWKS (JSON Web Key Set) from https://www.googleapis.com/oauth2/v3/certs
    // 2. Finds the correct key using the 'kid' (key ID) from the token header
    // 3. Verifies the signature using RS256 algorithm
    // 4. Checks token expiration (exp claim)
    // 5. Validates issuer (iss claim)
    // 6. Validates audience (aud claim) matches your client_id
    
    const claims = client.validateIdToken(idToken);
    
    return claims;
  } catch (error) {
    console.error('ID token verification failed:', error.message);
    throw new Error('Invalid ID token');
  }
}

/**
 * Extract user info from ID token claims
 * 
 * Standard OIDC claims:
 * - sub: Subject (unique user ID)
 * - email: User's email address
 * - email_verified: Boolean indicating email verification
 * - name: Full name
 * - given_name: First name
 * - family_name: Last name
 * - picture: Profile picture URL
 * - locale: User's locale (language)
 * 
 * @param {Object} claims - Verified token claims
 * @returns {Object} Structured user information
 */
function extractUserInfo(claims) {
  return {
    providerId: claims.sub,           // Unique ID from provider
    email: claims.email || null,
    emailVerified: claims.email_verified || false,
    fullName: claims.name || '',
    givenName: claims.given_name || '',
    familyName: claims.family_name || '',
    picture: claims.picture || '',
    locale: claims.locale || 'en',
  };
}

/**
 * Verify token expiration
 * 
 * @param {Object} claims - Token claims
 * @returns {boolean} True if token is still valid
 */
function isTokenExpired(claims) {
  if (!claims.exp) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = claims.exp * 1000;
  return Date.now() >= expirationTime;
}

module.exports = {
  verifyGoogleIdToken,
  extractUserInfo,
  isTokenExpired,
};

