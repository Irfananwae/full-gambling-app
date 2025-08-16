const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 20 },
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true }); // timestamps: true is a robust way to add createdAt/updatedAt

module.exports = mongoose.model('User', UserSchema);
