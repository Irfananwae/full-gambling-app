const mongoose = require('mongoose');

// 1. Define the blueprint (Schema)
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
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

// 2. Build the "car" (Model) from the blueprint and EXPORT it.
// This is the line that fixes the error.
module.exports = mongoose.model('User', UserSchema);

