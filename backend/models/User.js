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
  // Note: Using session-based authentication, no need for refresh tokens
});

const User = mongoose.model('User', userSchema);

module.exports = User;
