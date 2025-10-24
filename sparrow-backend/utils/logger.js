// Custom logging utility with timestamps
const logWithTimestamp = {
  log: (...args) => console.log(`[${new Date().toISOString()}]`, ...args),
  error: (...args) => console.error(`[${new Date().toISOString()}]`, ...args),
  warn: (...args) => console.warn(`[${new Date().toISOString()}]`, ...args),
  info: (...args) => console.info(`[${new Date().toISOString()}]`, ...args),
  debug: (...args) => console.debug(`[${new Date().toISOString()}]`, ...args)
};

module.exports = logWithTimestamp;
