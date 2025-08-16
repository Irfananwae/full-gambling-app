const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

// --- REGISTER ROUTE (Stays the same) ---
router.post('/register', async (req, res) => {
    // ... your working register code ...
});

// --- LOGIN ROUTE (WITH BREADCRUMBS) ---
router.post('/login', async (req, res) => {
    console.log("--- [LOGIN] NEW REQUEST RECEIVED ---");
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Please provide all fields." });
    }
  
    try {
        console.log("[LOGIN] BREADCRUMB 1: About to search for user in database...");
        const user = await User.findOne({ email });
        console.log("[LOGIN] BREADCRUMB 2: Finished searching for user.");

        if (!user) {
            console.log("[LOGIN] RESULT: User not found in database.");
            return res.status(400).json({ message: "Invalid credentials." });
        }
        
        console.log("[LOGIN] BREADCRUMB 3: User found. About to compare password...");
        const isMatch = await bcrypt.compare(password, user.password);
        console.log("[LOGIN] BREADCRUMB 4: Finished comparing password.");

        if (!isMatch) {
            console.log("[LOGIN] RESULT: Password did not match.");
            return res.status(400).json({ message: "Invalid credentials." });
        }
  
        console.log("[LOGIN] SUCCESS: Passwords match. Creating token...");
        const payload = { userId: user.id, email: user.email };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ token, message: "Logged in successfully!" });

    } catch (error) {
        console.error("--- [LOGIN] CRITICAL ERROR ---", error);
        res.status(500).json({ message: "Server error occurred during login." });
    }
});

module.exports = router;
      
