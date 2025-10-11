/**
 * Authentication Middleware
 * 
 * Protects routes by ensuring user is authenticated via session.
 * Works for both Google OAuth and email/phone/username login.
 * 
 * Usage:
 *   router.get('/protected', ensureAuthenticated, (req, res) => { ... });
 */

/**
 * Middleware: Ensure user is authenticated via session
 * 
 * This middleware checks for a valid session (stateful authentication).
 * Used by both Google OAuth and traditional login (email/phone/username).
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function ensureAuthenticated(req, res, next) {
  // Debug logging
  console.log('🔍 Auth middleware - Session ID:', req.sessionID);
  console.log('🔍 Auth middleware - Session exists:', !!req.session);
  console.log('🔍 Auth middleware - Session user:', !!req.session?.user);
  console.log('🔍 Auth middleware - Cookies:', req.headers.cookie);
  console.log('🔍 Auth middleware - Origin:', req.headers.origin);
  
  // Check session-based authentication
  if (req.session && req.session.user) {
    // User is authenticated via session
    req.user = req.session.user;
    console.log('✅ Auth middleware - User authenticated:', req.user.username);
    return next();
  }

  // Not authenticated
  console.log('❌ Auth middleware - No valid session found');
  return res.status(401).json({ 
    success: false, 
    error: 'Authentication required. Please login.' 
  });
}

module.exports = ensureAuthenticated;

