require('dotenv').config();

/**
 * CORS Configuration
 * Cross-Origin Resource Sharing setup
 */

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://www.sparrowchat.in',
  'https://sparrowchat.in',
  'https://api.sparrowchat.in',
  'https://sparrow-frontend-sigma.vercel.app',
  'http://localhost:3000'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      if (origin.endsWith('.vercel.app')) {
        console.log('✅ CORS allowed Vercel origin:', origin);
        callback(null, true);
      } else {
        console.log('❌ CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Cache-Control', 'Pragma'],
  optionsSuccessStatus: 200,
  exposedHeaders: ['set-cookie'],
};

module.exports = { corsOptions, allowedOrigins };

