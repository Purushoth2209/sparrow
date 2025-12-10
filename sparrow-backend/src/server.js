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
      
      // Optionally start workers if ENABLE_WORKERS=true
      const enableWorkers = process.env.ENABLE_WORKERS === 'true' || process.env.ENABLE_WORKERS === '1';
      
      if (enableWorkers) {
        console.log('🔄 Starting workers (embedded mode)...');
        
        // Start message worker
        try {
          require('./workers/message.worker');
          console.log('✅ Message worker started');
        } catch (error) {
          console.warn('⚠️ Failed to start message worker:', error.message);
          console.warn('   Workers are optional - server will continue without them');
          console.warn('   Messages are still saved, Socket.IO delivery still works');
        }
        
        // Start notification worker
        try {
          require('./workers/notification.worker');
          console.log('✅ Notification worker started');
        } catch (error) {
          console.warn('⚠️ Failed to start notification worker:', error.message);
          console.warn('   Workers are optional - server will continue without them');
          console.warn('   Messages are still saved, Socket.IO delivery still works');
        }
      } else {
        console.log('ℹ️  Workers disabled (set ENABLE_WORKERS=true to enable)');
        console.log('   Messages will still be saved, Socket.IO delivery works');
        console.log('   Async offline delivery requires workers to be running');
      }
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  });

module.exports = server;

