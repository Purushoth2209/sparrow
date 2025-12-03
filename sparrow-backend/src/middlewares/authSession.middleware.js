/**
 * Session Authentication Middleware
 * 
 * Alias for ensureAuthenticated middleware.
 * Provides semantic clarity when you want to emphasize session-based auth,
 * though ensureAuthenticated supports both session and JWT.
 * 
 * Usage:
 *   router.get('/protected', authSession, (req, res) => { ... });
 */

module.exports = require('./ensureAuthenticated');

