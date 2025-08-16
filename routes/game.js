const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

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

    // --- NEW VALIDATION RULES ---
    if (!betAmount || !chosenColor || betAmount < 10) { // Minimum bet is 10
        return res.status(400).json({ message: 'Invalid bet. Minimum is ₹10.' });
    }
    // --- END NEW VALIDATION ---

    try {
        const user = await User.findById(userId);
        if (!user || user.balance < betAmount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }
        user.balance -= betAmount;
        await user.save();
        
        req.app.get('registerBet')(userId, betAmount, chosenColor);
        res.json({ message: `Bet on ${chosenColor} placed!`, newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ message: 'Server error during game play.' });
    }
});




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
