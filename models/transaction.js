const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

// Middleware to get the user from the token
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Token is not valid' }); }
};

// POST: User requests a withdrawal
router.post('/request-withdrawal', auth, async (req, res) => {
    const { amount, bankDetails } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0 || !bankDetails) {
        return res.status(400).json({ message: 'Invalid request data.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user || user.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance.' });
        }
        
        // Deduct balance immediately and create the withdrawal request
        user.balance -= amount;
        await user.save();

        const withdrawal = new Withdrawal({ userId, amount, bankDetails });
        await withdrawal.save();

        res.status(201).json({ message: 'Withdrawal request submitted successfully!', newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ message: 'Server error during withdrawal request.' });
    }
});

module.exports = router;
