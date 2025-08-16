const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

// --- REGISTER ROUTE ---
// ... (rest of the file is the same) ...

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
        
        // --- THIS IS THE CRITICAL LINE ---
        // Ensure 'isAdmin' is included in the payload from the database user object.
        const payload = { 
            userId: user.id, 
            email: user.email, 
            isAdmin: user.isAdmin // This must be here!
        };
        // --- END OF CRITICAL LINE ---

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ token, message: "Logged in successfully!" });

    } catch (error) {
        console.error("--- [LOGIN] CRITICAL ERROR ---", error);
        res.status(500).json({ message: "A server error occurred during login." });
    }
});

module.exports = router;
