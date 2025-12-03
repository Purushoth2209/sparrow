/**
 * Configuration Index
 * Centralized configuration exports
 */

module.exports = {
  db: require('./db'),
  redis: require('./redis'),
  session: require('./session'),
  cors: require('./cors'),
  kms: require('./kms'),
  logger: require('./logger'),
  oidcClients: require('./oidcClients'),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret-key-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '30d'
  }
};

