require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { corsOptions } = require('./config/cors');
const { sessionMiddleware } = require('./config/session');
const logger = require('./config/logger');
const errorMiddleware = require('./middlewares/error.middleware');
const environment = require('./constants/environment');

// Override console methods globally for this application
console.log = logger.log;
console.error = logger.error;
console.warn = logger.warn;
console.info = logger.info;
console.debug = logger.debug;

const app = express();

// Trust proxy (needed for correct secure cookie handling behind proxies/CDNs)
app.set('trust proxy', 1);

// Enable CORS
app.use(cors(corsOptions));

// Parse JSON request bodies
app.use(bodyParser.json());

// Parse cookies FIRST (before session middleware)
app.use(cookieParser());

// Debug middleware to log cookie headers (optional - can be removed in production)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== environment.PRODUCTION) {
    console.log('🍪 Request cookies:', req.headers.cookie);
    console.log('🍪 Request origin:', req.headers.origin);
  }
  next();
});

// Configure session middleware AFTER cookie-parser
app.use(sessionMiddleware);

// Add debugging to see what's happening with session ID resolution
app.use((req, res, next) => {
  console.log('🔍 Session Middleware Debug:');
  console.log('  - req.sessionID:', req.sessionID);
  console.log('  - req.session:', req.session ? 'exists' : 'null');
  console.log('  - req.session.user:', req.session?.user ? 'exists' : 'null');
  console.log('  - req.cookies:', req.cookies);
  console.log('  - req.headers.cookie:', req.headers.cookie);
  next();
});

// Debug Session Store - Enhanced debugging to show serialization
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== environment.PRODUCTION) {
    console.log('🧠 Session Debug Info:');
    console.log('  📋 Session ID:', req.sessionID);
    console.log('  👤 User Data:', req.session.user || 'No user data');
    console.log('  🔑 Session Keys:', Object.keys(req.session || {}));
    console.log('  📊 Session Type:', typeof req.session);
    console.log('  🍪 Cookie Info:', req.session?.cookie ? {
      maxAge: req.session.cookie.maxAge,
      expires: req.session.cookie.expires,
      secure: req.session.cookie.secure,
      sameSite: req.session.cookie.sameSite
    } : 'No cookie data');
    
    if (req.session && Object.keys(req.session).length > 0) {
      console.log('  💾 How it looks in MongoDB (serialized):', JSON.stringify(req.session));
    }
    console.log('  ──────────────────────────────────────────');
  }
  next();
});

// Swagger API Documentation
const swaggerDocs = require('./docs/swagger');
app.use('/api-docs', swaggerDocs.serve, swaggerDocs.setup);

// Routes
const authRoutes = require('./routes/auth.routes');
const mobileAuthRoutes = require('./routes/mobileAuth.routes');
const messageRoutes = require('./routes/message.routes');
const oidcAuthRoutes = require('./routes/oidcAuth.routes');
const userRoutes = require('./routes/user.routes');
const friendRoutes = require('./routes/friend.routes');

// Web session-based auth routes (email/phone/username authentication)
app.use('/api/auth', authRoutes);

// Mobile JWT-based auth routes
app.use('/api/auth/mobile', mobileAuthRoutes);

// OIDC auth routes (Google login with OpenID Connect for web)
app.use('/auth', oidcAuthRoutes);

// Protected user routes (requires authentication)
app.use('/api', userRoutes);

// Friend request routes (requires authentication)
app.use('/api', friendRoutes);

// Message routes
app.use('/api/messages', messageRoutes);

// Health check route
const healthRoutes = require('./routes/health.routes');
app.use('/api', healthRoutes);

// Error handling middleware (must be last)
app.use(errorMiddleware);

module.exports = app;

