const mobileAuthService = require('../services/mobileAuth.service');
const { successResponse, errorResponse } = require('../utils/response');
const { AppError } = require('../utils/errors');

/**
 * Mobile Auth Controller
 * Handles HTTP request/response for mobile JWT-based authentication
 */

/**
 * POST /api/auth/mobile/login
 * Mobile login with username/email/phone + password
 */
exports.mobileLogin = async (req, res) => {
  try {
    const { identifier, email, phoneNumber, password, country } = req.body;

    // All validation and logic in service
    const result = await mobileAuthService.mobileLogin(
      identifier,
      email,
      phoneNumber,
      password,
      country
    );

    return successResponse(res, result, 'Login successful', 200);
  } catch (error) {
    console.error('❌ Mobile login error:', error);
    
    let statusCode = 500;
    if (error.message.includes('locked')) {
      statusCode = 423;
    } else if (error.message.includes('Invalid credentials') || error.message.includes('attempt')) {
      statusCode = 400;
    }
    
    return errorResponse(res, error.message || 'Server error', statusCode);
  }
};

/**
 * POST /api/auth/mobile/refresh
 * Refresh access token using refresh token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // All validation and logic in service
    const result = await mobileAuthService.refreshAccessToken(refreshToken);

    return successResponse(res, result, 'Token refreshed successfully', 200);
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    
    const statusCode = error.message.includes('expired') || error.message.includes('Invalid') ? 401 : 500;
    return errorResponse(res, error.message || 'Server error', statusCode);
  }
};

/**
 * POST /api/auth/mobile/logout
 * Logout - invalidate refresh token
 * Can be called with just refreshToken (no access token required)
 */
exports.mobileLogout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // All validation and logic in service
    await mobileAuthService.mobileLogout(refreshToken);

    return successResponse(res, null, 'Logout successful', 200);
  } catch (error) {
    console.error('❌ Mobile logout error:', error);
    
    const statusCode = error.message.includes('expired') || error.message.includes('Invalid') ? 401 : 500;
    return errorResponse(res, error.message || 'Server error', statusCode);
  }
};

/**
 * GET /api/auth/mobile/google-url
 * Get Google OIDC authorization URL for mobile
 */
exports.getGoogleAuthUrl = async (req, res) => {
  try {
    const result = await mobileAuthService.getGoogleAuthUrl();
    return successResponse(res, result, 'Google auth URL generated', 200);
  } catch (error) {
    console.error('❌ Google auth URL generation error:', error);
    return errorResponse(res, error.message || 'Server error', 500);
  }
};

/**
 * GET /api/auth/mobile/google/callback
 * Handle Google OIDC callback for mobile
 */
exports.googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    // All validation and logic in service
    const result = await mobileAuthService.handleGoogleCallback(code, state);

    return successResponse(res, result, 'Google authentication successful', 200);
  } catch (error) {
    console.error('❌ Google callback error:', error);
    
    const statusCode = error.message.includes('Invalid state') || error.message.includes('Invalid') || error.message.includes('expired') ? 400 : 500;
    return errorResponse(res, error.message || 'Server error', statusCode);
  }
};


