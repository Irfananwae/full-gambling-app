const express = require('express');
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const User = require('../models/User');
// ... other requires ...
const router = express.Router();
// Use the secret key from the environment, with a fallback for local testing
const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret"; 

// ... rest of the file is the same ...

// --- REGISTER ROUTE ---
router.post('/register', async (req, res) => {
    // --- DIAGNOSTICS START ---
    console.log("--- [REGISTER] NEW REQUEST RECEIVED ---");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Content-Type Header:", req.headers['content-type']);
    console.log("Request Body (raw):", JSON.stringify(req.body));
    // --- DIAGNOSTICS END ---

    const { email, password } = req.body;

    if (!email || !password) {
        console.log("Validation FAILED: Email or Password was missing or empty.");
        return res.status(400).json({ message: "Please provide all fields." });
    }

    try {
        console.log(`Attempting to find user with email: ${email}`);
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            console.log("User already exists.");
            return res.status(400).json({ message: "Email is already registered." });
        }

        console.log("User does not exist. Hashing password...");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        console.log("Creating new user in database...");
        const user = new User({ email, password: hashedPassword });
        await user.save();

        console.log("User created successfully!");
        return res.status(201).json({ message: "User registered successfully!" });

    } catch (error) {
        console.error("--- [REGISTER] CRITICAL ERROR ---");
        console.error("The operation failed. Full error details:", error);
        return res.status(500).json({ message: "Server error occurred during registration." });
    }
});

// --- LOGIN ROUTE (for completeness) ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Please provide all fields." });
    }
    // ... rest of login logic
    try {
      const user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: "Invalid credentials." });
      }
      const payload = { userId: user.id, email: user.email };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, message: "Logged in successfully!" });
    } catch (error) {
      console.error("--- [LOGIN] CRITICAL ERROR ---", error);
      res.status(500).json({ message: "Server error occurred during login." });
    }
});


module.exports = router;
