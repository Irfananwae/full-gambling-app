const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

// --- REGISTER ROUTE (WITH BREADCRUMBS) ---
router.post('/register', async (req, res) => {
    console.log("--- [REGISTER] NEW REQUEST RECEIVED ---");
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Please provide all fields." });
    }
  
    try {
        console.log("[REGISTER] BREADCRUMB 1: About to search for existing user...");
        const existingUser = await User.findOne({ email });
        console.log("[REGISTER] BREADCRUMB 2: Finished searching for existing user.");

        if (existingUser) {
            console.log("[REGISTER] RESULT: User already exists.");
            return res.status(400).json({ message: "Email is already registered." });
        }
        
        console.log("[REGISTER] BREADCRUMB 3: User is new. About to hash password...");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log("[REGISTER] BREADCRUMB 4: Finished hashing password.");

        console.log("[REGISTER] BREADCRUMB 5: About to save new user to database...");
        const user = new User({ email, password: hashedPassword });
        await user.save();
        console.log("[REGISTER] BREADCRUMB 6: Finished saving new user.");

        console.log("[REGISTER] SUCCESS: User created successfully!");
        res.status(201).json({ message: "User registered successfully!" });

    } catch (error) {
        console.error("--- [REGISTER] CRITICAL ERROR ---", error);
        res.status(500).json({ message: "Server error occurred during registration." });
    }
});

// --- LOGIN ROUTE (Stays the same with its own diagnostics) ---
router.post('/login', async (req, res) => {
    // ... your login diagnostic code ...
});

module.exports = router;
