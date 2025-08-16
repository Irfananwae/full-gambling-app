const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token' });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); }
    catch (e) { res.status(400).json({ message: 'Token is not valid' }); }
};

// --- SOLO SPIN ROUTE ---
router.post('/spin', auth, async (req, res) => {
    const { betAmount } = req.body;
    const userId = req.user.userId;
    if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ message: 'Invalid bet amount.' });
    }
    try {
        const user = await User.findById(userId);
        if (!user || user.balance < betAmount) {
            return res.status(400).json({ message: 'Insufficient balance.' });
        }
        
        // --- Slot Machine Logic ---
        const symbols = ['🌌', '🚀', '🪐', '👽', '☄️', '🌟'];
        const reels = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];
        
        let winnings = 0;
        // Payout rules (designed with a house edge)
        if (reels[0] === '🌟' && reels[1] === '🌟' && reels[2] === '🌟') winnings = betAmount * 50; // Jackpot
        else if (reels[0] === reels[1] && reels[1] === reels[2]) winnings = betAmount * 10; // Any three of a kind
        else if (reels[0] === reels[1] || reels[1] === reels[2]) winnings = betAmount * 2; // Any two of a kind

        const finalBalance = user.balance - betAmount + winnings;
        user.balance = finalBalance;
        await user.save();

        res.json({ reels, winnings, newBalance: finalBalance });
    } catch (err) {
        res.status(500).json({ message: 'Server error during spin.' });
    }
});

// --- JOIN BATTLE ROUTE ---
router.post('/join-battle', auth, async (req, res) => {
    const userId = req.user.userId;
    const email = req.user.email;
    const joinGalaxyBattle = req.app.get('joinGalaxyBattle');
    const entryFee = 50; // Should match the state on the backend

    try {
        const user = await User.findById(userId);
        if (!user || user.balance < entryFee) {
            return res.status(400).json({ message: 'Insufficient balance to join battle.' });
        }
        
        const result = joinGalaxyBattle(userId, email);
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        user.balance -= entryFee;
        await user.save();
        
        res.json({ message: 'Successfully joined the Galaxy Battle!', newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ message: 'Server error joining battle.' });
    }
});

module.exports = router;
