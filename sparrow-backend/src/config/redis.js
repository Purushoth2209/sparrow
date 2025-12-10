const Redis = require('ioredis');

/**
 * Redis Configuration
 * Redis connection setup for BullMQ queues
 */

let redisClient = null;

/**
 * Get or create Redis connection
 * @returns {Redis} Redis client instance
 */
function getRedisConnection() {
  if (redisClient) {
    return redisClient;
  }

  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  };

  redisClient = new Redis(redisConfig);

  redisClient.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
  });

  return redisClient;
}

/**
 * Get Redis connection configuration for BullMQ
 * @returns {Object} Connection config for BullMQ
 */
function getBullMQConnection() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

module.exports = {
  getRedisConnection,
  getBullMQConnection
};
