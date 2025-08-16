const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

// We NO LONGER need to import anything from server.js
// const { registerBet } = require('../server'); // DELETE THIS LINE

const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Token is not valid' }); }
};

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
        
        user.balance -= betAmount;
        await user.save();
        
        // --- THIS IS THE CRITICAL CHANGE ---
        // Access the function from the app object via the request (req)
        req.app.get('registerBet')(userId, betAmount, chosenColor);
        // --- END OF CRITICAL CHANGE ---

        res.json({ message: `Bet placed! Good luck.`, newBalance: user.balance });

    } catch (error) {
        console.error("GAME PLAY ERROR:", error);
        res.status(500).json({ message: 'Server error during game play.' });
    }
});

router.get('/balance', authMiddleware, async (req, res) => {
    // ... (balance route is the same) ...
});

module.exports = router;
