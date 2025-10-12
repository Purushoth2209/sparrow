require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const oidcAuthRoutes = require('./routes/oidcAuthRoutes');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const { initializeSocket } = require('./socketio');

const app = express();
const server = http.createServer(app);

// Enable CORS with credentials support for session-based auth
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://sparrow-frontend-sigma.vercel.app', // Your Vercel frontend
  'http://localhost:3000' // Local development
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
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

// Debug middleware to log cookie headers
app.use((req, res, next) => {
  console.log('🍪 Request cookies:', req.headers.cookie);
  console.log('🍪 Request origin:', req.headers.origin);
  console.log('🍪 Request user-agent:', req.headers['user-agent']);
  next();
});

// Configure express-session for OIDC authentication
// This manages user sessions and stores session data
app.use(
  session({
    // Secret key to sign session ID cookie (use strong random string in production)
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    // Don't save session if unmodified
    resave: false,
    // Don't create session until something is stored
    saveUninitialized: false,
    // Use a more robust session store for production
    store: process.env.NODE_ENV === 'production' 
      ? undefined // Let express-session handle it (uses default store)
      : new (require('express-session').MemoryStore)(),
    // Set session name to avoid conflicts
    name: 'sparrow.sid',
    cookie: {
      // Session expires after 7 days
      maxAge: 7 * 24 * 60 * 60 * 1000,
      // HttpOnly prevents client-side JS from reading cookie (security)
      httpOnly: true,
      // SameSite prevents CSRF attacks - use 'none' for cross-site requests
      sameSite: 'none',
      // Secure requires HTTPS (set to true in production with HTTPS)
      secure: true,
      // Domain for cookie (leave undefined for cross-origin requests)
      domain: undefined, // Always undefined for cross-origin
    },
  })
);

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
