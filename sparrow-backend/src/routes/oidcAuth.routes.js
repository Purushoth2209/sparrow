/**
 * OIDC Authentication Routes
 * 
 * Routes for OpenID Connect authentication with Google (and future providers).
 * Now consolidated with email/phone auth in the main authController.
 * 
 * Routes:
 * - GET /auth/google → Initiate Google login
 * - GET /auth/google/callback → Handle Google callback
 * - GET /auth/logout → Logout user
 * 
 * To add more providers, follow the same pattern:
 * - GET /auth/github → Initiate GitHub login
 * - GET /auth/github/callback → Handle GitHub callback
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// ===== Google OIDC Routes =====

/**
 * Initiate Google OIDC Login
 * 
 * User clicks "Login with Google" → redirects to Google's consent screen
 * 
 * @route   GET /auth/google
 * @access  Public
 */
router.get('/google', authController.googleLogin);

/**
 * Google OIDC Callback
 * 
 * Google redirects here after user authentication
 * Receives authorization code and exchanges it for tokens
 * 
 * @route   GET /auth/google/callback
 * @access  Public (but validates state for CSRF protection)
 */
router.get('/google/callback', authController.googleCallback);

// ===== Logout Route =====

/**
 * Logout User
 * 
 * Destroys session and clears authentication
 * Works for both Google OAuth and email/phone login
 * 
 * @route   GET /auth/logout
 * @access  Public (but destroys session if exists)
 */
router.get('/logout', authController.logoutUser);

// ===== Extension Points for Additional Providers =====

/**
 * To add GitHub authentication, uncomment and implement:
 * 
 * router.get('/github', oidcAuthController.githubLogin);
 * router.get('/github/callback', oidcAuthController.githubCallback);
 */

/**
 * To add Microsoft authentication, uncomment and implement:
 * 
 * router.get('/microsoft', oidcAuthController.microsoftLogin);
 * router.get('/microsoft/callback', oidcAuthController.microsoftCallback);
 */

module.exports = router;

