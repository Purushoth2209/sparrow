/**
 * Error Middleware
 * Centralized error handling
 */

const environment = require('../constants/environment');

module.exports = (err, req, res, next) => {
  console.error('❌ Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== environment.PRODUCTION && { stack: err.stack })
  });
};

