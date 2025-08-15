const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = "your_super_secret_key";

// Register
router.post('/register', async (req, res) => {

// --- DIAGNOSTIC LOG ---
console.log("--- NEW REGISTRATION ATTEMPT ---");
console.log("Received body:", req.body);

const { email, password } = req.body;
if (!email || !password) {
console.log("Validation failed: Email or Password is empty.");
return res.status(400).json({ message: "Please provide all fields." });
}

// ... rest of the code is the same ...
try {
if (await User.findOne({ email })) return res.status(400).json({ message: "Email is already registered." });
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);
const user = new User({ email, password: hashedPassword });
await user.save();
res.status(201).json({ message: "User registered successfully!" });
} catch (error) { res.status(500).json({ message: "Server error" }); }
});

// We only need to debug one route for now. Login route remains the same.
router.post('/login', async (req, res) => {
// ... login code ...
});

module.exports = router;

