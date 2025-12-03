const jwtService = require('../services/jwt.service');
const userRepository = require('../repositories/user.repository');
const { errorResponse } = require('../utils/response');

/**
 * JWT Authentication Helper Function
 * Validates JWT token and returns user object
 * 
 * @param {string} token - JWT access token
 * @returns {Promise<Object>} User object
 * @throws {Error} If token is invalid or expired
 */
async function authenticateWithJWT(token) {
  if (!token) {
    throw new Error('No token provided');
  }

  // Verify access token
  const decoded = jwtService.verifyAccessToken(token);

  // Get user from database to ensure they still exist
  const user = await userRepository.findUserByProfileId(decoded.profileId);
  if (!user) {
    throw new Error('User not found');
  }

  // Return user object
  return {
    profileId: user.profileId,
    userId: user.profileId,
    username: user.username,
    email: user.email,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
    profileImage: user.profileImage
  };
}

/**
 * JWT Authentication Middleware
 * Validates JWT tokens for mobile app authentication
 * 
 * Reads Authorization: Bearer <token> header
 * Verifies token and attaches user to req.user
 * 
 * Use this for routes that REQUIRE JWT (no session fallback)
 */
async function authJWT(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      return errorResponse(res, 'No token provided', 401);
    }

    // Authenticate with JWT
    req.user = await authenticateWithJWT(token);
    console.log('✅ JWT middleware - User authenticated:', req.user.username);
    next();
  } catch (error) {
    console.error('❌ JWT middleware error:', error);
    
    if (error.message.includes('expired')) {
      return errorResponse(res, 'Token expired', 401);
    }
    
    if (error.message.includes('Invalid')) {
      return errorResponse(res, 'Invalid token', 401);
    }
    
    if (error.message.includes('No token')) {
      return errorResponse(res, 'No token provided', 401);
    }
    
    if (error.message.includes('User not found')) {
      return errorResponse(res, 'User not found', 401);
    }
    
    return errorResponse(res, 'Authentication failed', 401);
  }
}

// Export both the middleware and the helper function
module.exports = authJWT;
module.exports.authenticateWithJWT = authenticateWithJWT;

