const express = require('express');
// ... other requires ...
const router = express.Router();
const User = require('../models/User'); // Make sure this is here
const jwt = require('jsonwebtoken'); // Make sure this is here

// Use the exact same secret key from the environment
const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret"; 

// The authMiddleware now uses the correct key to verify
const authMiddleware = (req, res, next) => {
    // ... middleware code is the same ...
};

// ... rest of the file is the same ...


// Middleware to protect routes and get user
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Token is not valid' }); }
};

// Color Prediction Game Logic
router.post('/play-color-game', authMiddleware, async (req, res) => {
    const { betAmount, chosenColor } = req.body;
    if (!betAmount || !chosenColor || betAmount <= 0) return res.status(400).json({ message: 'Invalid bet' });

    try {
        const user = await User.findById(req.user.userId);
        if (!user || user.balance < betAmount) return res.status(400).json({ message: 'Insufficient balance' });

        const colors = ['red', 'green', 'blue'];
        const winningColor = colors[Math.floor(Math.random() * colors.length)];

        let newBalance = user.balance;
        let message = '';
        
        if (chosenColor.toLowerCase() === winningColor) {
            newBalance += betAmount * 1; // Win 2x the bet amount (bet + winnings)
            message = `You WON! The color was ${winningColor}.`;
        } else {
            newBalance -= betAmount;
            message = `You lost. The winning color was ${winningColor}.`;
        }
        
        user.balance = newBalance;
        await user.save();
        res.json({ message, newBalance: user.balance, winningColor });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// Get User Balance
router.get('/balance', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('balance username');
        if(!user) return res.status(404).json({ message: "User not found"});
        res.json(user);
    } catch (error) { res.status(500).json({ message: "Server Error" }); }
});

module.exports = router;
