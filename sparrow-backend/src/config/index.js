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
  oidcClients: require('./oidcClients')
};

