require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const oidcAuthRoutes = require('./routes/oidcAuthRoutes');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const { initializeSocket } = require('./socketio');

const app = express();
const server = http.createServer(app);

// Trust proxy (needed for correct secure cookie handling behind proxies/CDNs)
app.set('trust proxy', 1);

// Enable CORS with credentials support for session-based auth
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://www.sparrowchat.in', // Your custom domain frontend
  'https://sparrowchat.in', // Your custom domain without www
  'https://api.sparrowchat.in', // Your backend domain
  'https://sparrow-frontend-sigma.vercel.app', // Vercel deployment
  'http://localhost:3000' // Local development
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check exact matches first
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Check for Vercel wildcard pattern
      if (origin.endsWith('.vercel.app')) {
        console.log('✅ CORS allowed Vercel origin:', origin);
        callback(null, true);
      } else {
        console.log('❌ CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,               // Allow cookies to be sent (required for sessions)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Cache-Control', 'Pragma'],
  optionsSuccessStatus: 200,       // Some legacy browsers (IE11, various SmartTVs) choke on 204
  exposedHeaders: ['set-cookie'],  // Expose set-cookie header to client
}));


// Parse JSON request bodies
app.use(bodyParser.json());

// Parse cookies FIRST (before session middleware)
app.use(cookieParser());

// Debug middleware to log cookie headers (optional - can be removed in production)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🍪 Request cookies:', req.headers.cookie);
    console.log('🍪 Request origin:', req.headers.origin);
  }
  next();
});

app.set('trust proxy', 1);

// Configure express-session for OIDC authentication
// Using built-in MemoryStore for single-instance deployment (AWS EB)
const MemoryStore = require('express-session').MemoryStore;
const sessionConfig = {
  name: 'sparrow.sid',
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: true, // Force resave to ensure data persistence
  saveUninitialized: true, // Save even uninitialized sessions
  store: new MemoryStore(),
  proxy: true, // always true when using reverse proxy (Nginx, Render, etc.)
  rolling: false, // Don't reset expiration on every request
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only require HTTPS in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'lax' for localhost
    // Remove domain restriction to see if that's causing the issue
    // domain: process.env.COOKIE_DOMAIN || '.sparrowchat.in',
  },
  genid: (req) => {
    // Let express-session handle session ID generation naturally
    const newSessionId = require('crypto').randomBytes(32).toString('hex');
    console.log('🆕 Generating new session ID:', newSessionId);
    return newSessionId;
  },
};

console.log('🔧 Session Configuration:', {
  name: sessionConfig.name,
  secret: sessionConfig.secret ? '***SET***' : 'NOT SET',
  store: 'Built-in MemoryStore',
  resave: sessionConfig.resave,
  saveUninitialized: sessionConfig.saveUninitialized,
  cookieDomain: sessionConfig.cookie.domain || 'default',
  cookieSecure: sessionConfig.cookie.secure,
  cookieSameSite: sessionConfig.cookie.sameSite
});

// Configure session middleware AFTER cookie-parser
const sessionMiddleware = session(sessionConfig);
console.log('🔧 Session middleware created:', !!sessionMiddleware);
console.log('🔧 Session config store:', !!sessionConfig.store);

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

// Session ID resolution is now handled naturally by express-session


// Debug Session Store - Enhanced debugging to show serialization
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
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
    
    // Show how the data would look when serialized to MongoDB
    if (req.session && Object.keys(req.session).length > 0) {
      console.log('  💾 How it looks in MongoDB (serialized):', JSON.stringify(req.session));
    }
    console.log('  ──────────────────────────────────────────');
  }
  next();
});

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // JWT-based auth routes (email/phone/username authentication)
    app.use('/api/auth', authRoutes);
    
    // OIDC auth routes (Google login with OpenID Connect)
    app.use('/auth', oidcAuthRoutes);
    
    // Protected user routes (requires authentication)
    app.use('/api', userRoutes);
    
    // Friend request routes (requires authentication)
    app.use('/api', friendRoutes);
    
    // Message routes
    app.use('/api/messages', messageRoutes);
    
    // Initialize Socket.IO for real-time chat
    initializeSocket(server).catch(err => {
      console.error('❌ Socket.IO initialization failed:', err);
    });
    
    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔐 Google OIDC login: http://localhost:${PORT}/auth/google`);
      console.log(`📊 API endpoints:`);
      console.log(`   - POST /api/auth/register → Email/phone registration`);
      console.log(`   - POST /api/auth/login → Email/phone login`);
      console.log(`   - GET  /auth/google → Google OIDC login`);
      console.log(`   - GET  /api/user → Get current user (protected)`);
      console.log(`   - GET  /auth/logout → Logout`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  });
