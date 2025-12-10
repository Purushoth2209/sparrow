// dotenv is loaded in app.js (entry point)
const mongoose = require('mongoose');

/**
 * Database Configuration
 * MongoDB connection setup
 */

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  
  if (!mongoURI) {
    throw new Error('MONGO_URI environment variable is not set');
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
};

module.exports = { connectDB };

