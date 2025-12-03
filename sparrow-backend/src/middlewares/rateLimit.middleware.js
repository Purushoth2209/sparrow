/**
 * Rate Limit Middleware
 * Rate limiting for API endpoints
 */

const rateLimit = require('express-rate-limit');

/**
 * Login rate limiter
 * 20 requests per 15 minutes
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again later.',
});

/**
 * Logout rate limiter
 * 10 requests per minute
 */
const logoutLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many logout requests, please try again later.',
});

/**
 * Token refresh rate limiter
 * 50 requests per 15 minutes
 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many token refresh requests, please try again later.',
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

module.exports = {
  loginLimiter,
  logoutLimiter,
  refreshLimiter,
  generalLimiter
};

