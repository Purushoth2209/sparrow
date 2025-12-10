// dotenv is loaded in app.js (entry point)
const session = require('express-session');
const MongoStore = require('connect-mongo');
const environment = require('../constants/environment');

/**
 * Session Configuration
 * Express session setup with MongoDB store
 */

const sessionConfig = {
  name: 'sparrow.sid.v2',
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  proxy: true,
  rolling: true,
  cookie: {
    domain: process.env.NODE_ENV === environment.PRODUCTION ? '.sparrowchat.in' : undefined,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: process.env.NODE_ENV === environment.PRODUCTION,
    secure: process.env.NODE_ENV === environment.PRODUCTION,
    sameSite: process.env.NODE_ENV === environment.PRODUCTION ? 'none' : 'lax',
  },
};

const sessionMiddleware = session(sessionConfig);

module.exports = { sessionConfig, sessionMiddleware };

