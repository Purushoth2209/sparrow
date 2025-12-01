const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initializeSocket } = require('./socket');

const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    // Initialize Socket.IO for real-time chat
    initializeSocket(server).catch(err => {
      console.error('❌ Socket.IO initialization failed:', err);
    });

    // Start server
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

module.exports = server;

