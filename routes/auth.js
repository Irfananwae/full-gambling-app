// routes/auth.js  (DEBUGGING VERSION)

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = "your_super_secret_key";

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: "Please provide all fields." });

  try {
    if (await User.findOne({ username })) return res.status(400).json({ message: "User already exists." });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    // --- THIS IS THE CHANGE ---
    console.error("REGISTER ERROR:", error); // Log the full error on Render
    res.status(500).json({ message: "DEBUG: " + error.message }); // Send the specific error to the screen
  }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Please provide all fields." });
  
    try {
      const user = await User.findOne({ username });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: "Invalid credentials." });
      }
  
      const payload = { userId: user.id, username: user.username, isAdmin: user.isAdmin };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, message: "Logged in successfully!" });
    } catch (error) {
      // --- THIS IS THE CHANGE ---
      console.error("LOGIN ERROR:", error); // Log the full error on Render
      res.status(500).json({ message: "DEBUG: " + error.message }); // Send the specific error to the screen
    }
});

module.exports = router;
