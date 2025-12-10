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

/**
 * Message sending rate limiter (per user)
 * Prevents chat flooding and DDoS on message queue
 * 
 * Limits:
 * - 10 messages per second per user
 * - 100 messages per minute per user
 */
const messageSendLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10, // 10 messages per second
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many messages sent. Please slow down (max 10 messages per second).',
  keyGenerator: (req) => {
    // Rate limit per user (sender)
    return req.user?.profileId || req.ip;
  },
  skip: (req) => {
    // Skip if user is not authenticated (will be caught by auth middleware)
    return !req.user;
  }
});

/**
 * Message sending rate limiter (per minute)
 * Secondary limit: 100 messages per minute per user
 */
const messageSendMinuteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many messages sent. Please slow down (max 100 messages per minute).',
  keyGenerator: (req) => {
    // Rate limit per user (sender)
    return req.user?.profileId || req.ip;
  },
  skip: (req) => {
    // Skip if user is not authenticated (will be caught by auth middleware)
    return !req.user;
  }
});

module.exports = {
  loginLimiter,
  logoutLimiter,
  refreshLimiter,
  generalLimiter,
  messageSendLimiter,
  messageSendMinuteLimiter
};

