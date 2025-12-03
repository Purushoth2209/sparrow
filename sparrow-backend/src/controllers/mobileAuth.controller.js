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

    const hasValidIdentifier = identifier && identifier.trim().length > 0;
    const hasValidEmail = email && email.trim().length > 0;
    const hasValidPhone = phoneNumber && phoneNumber.trim().length > 0;
    const hasValidPassword = password && password.trim().length > 0;

    if (!hasValidPassword || (!hasValidIdentifier && !hasValidEmail && !hasValidPhone)) {
      return errorResponse(res, 'Invalid credentials', 400);
    }

    const idRaw = typeof identifier === 'string' ? identifier.trim() : undefined;
    const emailRaw = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    const phoneRaw = typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined;

    const result = await mobileAuthService.mobileLogin(
      idRaw || emailRaw || phoneRaw,
      emailRaw,
      phoneRaw,
      password,
      country
    );

    return successResponse(res, result, 'Login successful', 200);
  } catch (error) {
    console.error('❌ Mobile login error:', error);
    
    if (error.message.includes('locked')) {
      return errorResponse(res, error.message, 423);
    }
    
    if (error.message.includes('Invalid credentials') || error.message.includes('attempt')) {
      return errorResponse(res, error.message, 400);
    }
    
    return errorResponse(res, error.message || 'Server error', 500);
  }
};

/**
 * POST /api/auth/mobile/refresh
 * Refresh access token using refresh token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      return errorResponse(res, 'Refresh token is required', 400);
    }

    const result = await mobileAuthService.refreshAccessToken(refreshToken);

    return successResponse(res, result, 'Token refreshed successfully', 200);
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    
    if (error.message.includes('expired') || error.message.includes('Invalid')) {
      return errorResponse(res, error.message, 401);
    }
    
    return errorResponse(res, error.message || 'Server error', 500);
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

    if (!refreshToken || typeof refreshToken !== 'string') {
      return errorResponse(res, 'Refresh token is required', 400);
    }

    await mobileAuthService.mobileLogout(refreshToken);

    return successResponse(res, null, 'Logout successful', 200);
  } catch (error) {
    console.error('❌ Mobile logout error:', error);
    
    if (error.message.includes('expired') || error.message.includes('Invalid')) {
      return errorResponse(res, error.message, 401);
    }
    
    return errorResponse(res, error.message || 'Server error', 500);
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

    if (!code || !state) {
      return errorResponse(res, 'Missing required parameters (code, state)', 400);
    }

    const result = await mobileAuthService.handleGoogleCallback(code, state);

    return successResponse(res, result, 'Google authentication successful', 200);
  } catch (error) {
    console.error('❌ Google callback error:', error);
    
    if (error.message.includes('Invalid state') || error.message.includes('Invalid') || error.message.includes('expired')) {
      return errorResponse(res, error.message, 400);
    }
    
    return errorResponse(res, error.message || 'Server error', 500);
  }
};


