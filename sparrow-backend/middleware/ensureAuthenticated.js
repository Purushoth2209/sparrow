const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * 
 * Protects routes by ensuring user is authenticated via JWT token or session.
 * Works for both Google OAuth and email/phone/username login.
 * 
 * Usage:
 *   router.get('/protected', ensureAuthenticated, (req, res) => { ... });
 */

/**
 * Middleware: Ensure user is authenticated via JWT token or session
 * 
 * This middleware checks for a valid JWT token (stateless) or session (stateful).
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
  console.log('🔍 Auth middleware - Authorization header:', req.headers.authorization);
  console.log('🔍 Auth middleware - Origin:', req.headers.origin);
  
  // Check JWT token authentication (stateless)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log('✅ Auth middleware - User authenticated via JWT:', req.user.username);
      return next();
    } catch (error) {
      console.log('❌ Auth middleware - Invalid JWT token:', error.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token. Please login again.' 
      });
    }
  }
  
  // Check session-based authentication (stateful - for Google OAuth)
  if (req.session && req.session.user) {
    // User is authenticated via session
    req.user = req.session.user;
    console.log('✅ Auth middleware - User authenticated via session:', req.user.username);
    return next();
  }

  // Not authenticated
  console.log('❌ Auth middleware - No valid authentication found');
  return res.status(401).json({ 
    success: false, 
    error: 'Authentication required. Please login.' 
  });
}

module.exports = ensureAuthenticated;

