const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    required: false,
    unique: true,
    sparse: true
    // No default value - leave undefined for Google OAuth users
  },
  password: {
    type: String,
    required: true
  },
  profileId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  friends: [{ type: String }], // profileIds of accepted friends
  friendRequests: [
    {
      fromUserId: { type: String, required: true },
      status: { type: String, enum: ['pending','accepted','rejected'], default: 'pending' },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  socketId: {
    type: String,
    default: null,
  },
  profileImage: { type: String, default: '' },
  accountCreationDate: { type: Date, default: Date.now },
  // Security fields for account lockout
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  lastLoginAttempt: { type: Date, default: null },
  // Password security
  passwordChangedAt: { type: Date, default: null },
  // Username setup flag for Google OAuth users
  needsUsernameSetup: { type: Boolean, default: false },
  // Refresh tokens for mobile JWT authentication
  refreshTokens: [{ type: String }],
  // Note: Using session-based authentication for web, JWT for mobile
});

const User = mongoose.model('User', userSchema);

module.exports = User;
