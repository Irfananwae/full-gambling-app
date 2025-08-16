const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Use the secret key from the environment, with a fallback for local testing
const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

// Middleware to protect routes and get user
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ message: 'Token is not valid' });
    }
};

// --- THERE IS NO mongoose.connect() COMMAND IN THIS FILE ---
// ... (keep all the top part of the file the same) ...

// Color Prediction Game Logic
// ... (top of the file is the same) ...

router.post('/play-color-game', authMiddleware, async (req, res) => {
    const { betAmount, chosenColor } = req.body;
    const userId = req.user.userId;

    if (!betAmount || !chosenColor || betAmount <= 0) {
        return res.status(400).json({ message: 'Invalid bet' });
    }

    try {
        const user = await User.findById(userId);
        if (!user || user.balance < betAmount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }
        
        // Immediately deduct the bet amount
        user.balance -= betAmount;
        await user.save();
        
        // Register the bet with the live game engine for payout processing
        req.registerBet(userId, betAmount, chosenColor);

        res.json({ message: `Bet placed!`, newBalance: user.balance });

    } catch (error) {
        console.error("GAME PLAY ERROR:", error);
        res.status(500).json({ message: 'Server error during game play.' });
    }
});

// ... (rest of the file is the same) ...
module.exports = router;


// Get User Balance
router.get('/balance', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('balance email');
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;

        
