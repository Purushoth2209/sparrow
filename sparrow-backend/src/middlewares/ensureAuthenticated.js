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
 * This middleware checks for a valid session (stateful).
 * Used by both Google OAuth and traditional login (email/phone/username).
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function ensureAuthenticated(req, res, next) {
  // Enhanced debug logging for session troubleshooting
  console.log('🔍 Auth middleware - Session ID:', req.sessionID);
  console.log('🔍 Auth middleware - Session exists:', !!req.session);
  console.log('🔍 Auth middleware - Session user exists:', !!req.session?.user);
  console.log('🔍 Auth middleware - Cookies:', req.headers.cookie);
  console.log('🔍 Auth middleware - Origin:', req.headers.origin);
  console.log('🔍 Auth middleware - User-Agent:', req.headers['user-agent']);
  
  // Detailed session inspection
  if (req.session) {
    console.log('🔍 Auth middleware - Session data:', {
      hasUser: !!req.session.user,
      userProfileId: req.session.user?.profileId,
      userUsername: req.session.user?.username,
      sessionKeys: Object.keys(req.session),
      sessionModified: req.session.cookie?.maxAge
    });
  } else {
    console.log('❌ Auth middleware - No session object found');
  }
  
  // Check session-based authentication (stateful)
  if (req.session && req.session.user) {
    // User is authenticated via session
    req.user = req.session.user;
    console.log('✅ Auth middleware - User authenticated via session:', req.user.username);
    console.log('✅ Auth middleware - User profileId:', req.user.profileId);
    return next();
  }

  // Not authenticated - provide detailed error information
  console.log('❌ Auth middleware - Authentication failed:');
  console.log('  - Session exists:', !!req.session);
  console.log('  - Session user exists:', !!req.session?.user);
  console.log('  - Session ID:', req.sessionID);
  console.log('  - Request cookies:', req.headers.cookie);
  
  return res.status(401).json({ 
    success: false, 
    error: 'Authentication required. Please login.',
    debug: {
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionId: req.sessionID
    }
  });
}

module.exports = ensureAuthenticated;

