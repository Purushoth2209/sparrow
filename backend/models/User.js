const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true
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
  contacts: [
    {
      profileId: {
        type: String,
        required: true
      },
      username: {
        type: String,
        required: true
      },
      phoneNumber: {
        type: String,
        required: true
      }   
    }
  ],
  isOnline: {
    type: Boolean,
    default: false,
  },
  socketId: {
    type: String,
    default: null,
  },
  profileImage: { type: String, default: '' },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
