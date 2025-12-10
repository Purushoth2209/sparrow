/**
 * Unified Authentication Middleware
 * Supports both session-based (web) and JWT-based (mobile) authentication
 * 
 * Usage:
 *   router.get('/protected', authAny, (req, res) => { ... });
 */

const jwtService = require('../services/jwt.service');
const { errorResponse } = require('../utils/response');
const { authenticateWithJWT } = require('./authJWT.middleware');

/**
 * Middleware: Ensure user is authenticated via session OR JWT token
 * 
 * This middleware checks for:
 * 1. Session-based authentication (stateful) - for web
 * 2. JWT token authentication (stateless) - for mobile
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function authAny(req, res, next) {
  // Try session-based authentication first (for web)
  if (req.session && req.session.user) {
    // User is authenticated via session (web)
    req.user = req.session.user;
    req.authSource = 'session';
    return next();
  }

  // Try JWT token authentication (for mobile)
  const authHeader = req.headers.authorization;
  const token = jwtService.extractTokenFromHeader(authHeader);

  if (token) {
    try {
      // Use the reusable JWT authentication function
      req.user = await authenticateWithJWT(token);
      req.authSource = 'jwt';
      return next();
    } catch (error) {
      // JWT verification failed - return specific error
      console.error('❌ JWT authentication failed:', error.message);
      
      if (error.message.includes('expired')) {
        return errorResponse(res, 'Token expired. Please refresh your token.', 401);
      }
      
      if (error.message.includes('Invalid')) {
        return errorResponse(res, 'Invalid token. Please login again.', 401);
      }
      
      if (error.message.includes('User not found')) {
        return errorResponse(res, 'User not found', 401);
      }
      
      return errorResponse(res, 'JWT authentication failed', 401);
    }
  }

  // Neither session nor JWT token authentication succeeded
  console.log('❌ Auth middleware - Authentication failed:');
  console.log('  - Session exists:', !!req.session);
  console.log('  - Session user exists:', !!req.session?.user);
  console.log('  - JWT token provided:', !!req.headers.authorization);
  
  return res.status(401).json({ 
    success: false, 
    error: 'Authentication required. Please login or provide a valid JWT token.',
    message: 'Authentication required. Please login or provide a valid JWT token.',
    debug: {
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      sessionId: req.sessionID,
      hasJWTToken: !!req.headers.authorization
    }
  });
}

module.exports = authAny;


