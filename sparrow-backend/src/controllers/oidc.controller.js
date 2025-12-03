const oidcService = require('../services/oidc.service');
const sessionService = require('../services/session.service');
const { errorResponse } = require('../utils/response');

/**
 * OIDC Controller
 * Handles HTTP request/response for Google OIDC authentication
 */

/**
 * Initiate Google OIDC login
 */
exports.googleLogin = async (req, res) => {
  try {
    const authorizationUrl = await oidcService.initiateGoogleLogin(req);
    res.redirect(authorizationUrl);
  } catch (error) {
    return errorResponse(res, 'Failed to initiate Google login', 500);
  }
};

/**
 * Handle Google OIDC callback
 */
exports.googleCallback = async (req, res) => {
  try {
    const user = await oidcService.handleGoogleCallback(req);

    // Clean up OIDC state/nonce
    oidcService.cleanupOidcState(req);

    // Persist session (buildSessionUser is called internally)
    try {
      await sessionService.saveSession(req, user);

      // Redirect based on username setup requirement
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      if (user.needsUsernameSetup) {
        return res.redirect(`${frontendUrl}/setup-username`);
      }
      return res.redirect(`${frontendUrl}/friends`);
    } catch (sessionError) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/login?error=session_failed`);
    }
  } catch (error) {
    // Clean up OIDC state/nonce on error
    oidcService.cleanupOidcState(req);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};

