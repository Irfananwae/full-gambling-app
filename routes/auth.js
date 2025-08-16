const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

// --- REGISTER ROUTE ---
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email is already registered." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        
        const user = new User({ email, password: hashedPassword });
        await user.save(); // This is the critical step

        res.status(201).json({ message: "User registered successfully! Please log in." });

    } catch (error) {
        console.error("--- [REGISTER] CRITICAL ERROR ---", error);
        res.status(500).json({ message: "A server error occurred during registration." });
    }
});

// --- LOGIN ROUTE ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials." });
        }
        
        const payload = { userId: user.id, email: user.email };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ token, message: "Logged in successfully!" });

    } catch (error) {
        console.error("--- [LOGIN] CRITICAL ERROR ---", error);
        res.status(500).json({ message: "A server error occurred during login." });
    }
});

module.exports = router;
