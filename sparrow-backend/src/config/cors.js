// dotenv is loaded in app.js (entry point)

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
  'http://localhost:3000',
  'http://localhost:5000', // Backend server and Swagger UI
  'http://127.0.0.1:5000', // Alternative localhost format
  'http://127.0.0.1:3000' // Alternative localhost format
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl, Swagger UI internal requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow requests from same origin (Swagger UI on same server)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      const port = process.env.PORT || 5000;
      if (origin.includes(`:${port}`) || origin.includes(':3000')) {
        return callback(null, true);
      }
    }
    
    // Check allowed origins list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Allow Vercel deployments
      if (origin.endsWith('.vercel.app')) {
        console.log('✅ CORS allowed Vercel origin:', origin);
        callback(null, true);
      } else {
        // In development, be more permissive for localhost
        if (process.env.NODE_ENV === environment.DEVELOPMENT && origin.includes('localhost')) {
          console.log('✅ CORS allowed localhost in development:', origin);
          callback(null, true);
        } else {
          console.log('❌ CORS blocked origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
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

