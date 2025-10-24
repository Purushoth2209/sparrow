// Custom logging utility with timestamps
// Store original console methods to avoid circular reference
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console)
};

const logWithTimestamp = {
  log: (...args) => originalConsole.log(`[${new Date().toISOString()}]`, ...args),
  error: (...args) => originalConsole.error(`[${new Date().toISOString()}]`, ...args),
  warn: (...args) => originalConsole.warn(`[${new Date().toISOString()}]`, ...args),
  info: (...args) => originalConsole.info(`[${new Date().toISOString()}]`, ...args),
  debug: (...args) => originalConsole.debug(`[${new Date().toISOString()}]`, ...args)
};

module.exports = logWithTimestamp;
