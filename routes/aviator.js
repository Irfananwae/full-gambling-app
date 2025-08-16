const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

// Auth middleware to get user from token
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Token is not valid' }); }
};

// POST: /api/aviator/place-bet
// Handles bets from either of the two bet panels
router.post('/place-bet', auth, async (req, res) => {
    const { betAmount, betPanelId } = req.body; // betPanelId will be 'panel1' or 'panel2'
    const userId = req.user.userId;

    if (!betAmount || betAmount <= 0 || !betPanelId) {
        return res.status(400).json({ message: 'Invalid bet data.' });
    }
    
    // Use the globally shared function from server.js to register the bet
    const placeAviatorBet = req.app.get('placeAviatorBet');
    
    try {
        const user = await User.findById(userId);
        if (!user || user.balance < betAmount) {
            return res.status(400).json({ message: 'Insufficient balance.' });
        }
        
        // Let the game engine handle the bet placement logic
        const result = placeAviatorBet(userId, betAmount, betPanelId);
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        // Deduct balance
        user.balance -= betAmount;
        await user.save();
        
        res.json({ message: 'Bet placed successfully!', newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ message: 'Server error placing bet.' });
    }
});

// POST: /api/aviator/cash-out
// Handles cash-outs from either panel
router.post('/cash-out', auth, async (req, res) => {
    const { betPanelId } = req.body;
    const userId = req.user.userId;

    // Use the globally shared function from server.js
    const cashOutAviator = req.app.get('cashOutAviator');
    const result = await cashOutAviator(userId, betPanelId);

    if (result.success) {
        res.json({ message: `Cashed out at ${result.multiplier}x!`, newBalance: result.newBalance });
    } else {
        res.status(400).json({ message: result.message });
    }
});

module.exports = router;
