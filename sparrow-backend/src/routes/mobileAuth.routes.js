/**
 * Mobile Auth Routes
 * Routes for mobile-specific JWT-based authentication
 */

const express = require('express');
const router = express.Router();
const {
  mobileLogin,
  refreshToken,
  mobileLogout,
  getGoogleAuthUrl,
  googleCallback
} = require('../controllers/mobileAuth.controller');
const authJWT = require('../middlewares/authJWT.middleware');
const { loginLimiter, refreshLimiter } = require('../middlewares/rateLimit.middleware');

// Mobile login (username/email/phone + password)
router.post('/login', loginLimiter, mobileLogin);

// Token refresh
router.post('/refresh', refreshLimiter, refreshToken);

// Google OIDC authentication
router.get('/google-url', getGoogleAuthUrl);
router.get('/google/callback', googleCallback);

// Logout (no authentication required - uses refreshToken in body)
router.post('/logout', mobileLogout);

module.exports = router;

