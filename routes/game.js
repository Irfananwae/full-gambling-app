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
router.post('/play-color-game', authMiddleware, async (req, res) => {
    // We add roundId to the request body
    const { betAmount, chosenColor, roundId } = req.body; 

    if (!betAmount || !chosenColor || betAmount <= 0) {
        return res.status(400).json({ message: 'Invalid bet' });
    }

    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.balance < betAmount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }
        
        // This is the core logic. Subtract the bet amount immediately.
        user.balance -= betAmount;
        
        // We will add the winnings later if they win.
        // For now, just save the new lower balance.
        // This prevents double-betting.
        await user.save();
        
        // The game result is now handled by the socket.io logic.
        // This route's only job is to accept the bet and deduct the balance.
        // We don't calculate win/loss here anymore.

        // We can add a more complex system later to check the result against the roundId
        // but for now this is simpler and safer.

        res.json({ message: `Bet placed for round ${roundId}`, newBalance: user.balance });

    } catch (error) {
        console.error("GAME PLAY ERROR:", error);
        res.status(500).json({ message: 'Server error during game play.' });
    }
});

// ... (keep the /balance route the same) ...

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

        
