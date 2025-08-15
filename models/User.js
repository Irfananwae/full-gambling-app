const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { // <-- CHANGED from username
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true // Good practice to store emails in lowercase
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 20
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
