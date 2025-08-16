const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Deposit = require('../models/Deposit'); // We need this model
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

// Middleware to get the user from the token
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) { res.status(400).json({ message: 'Token is not valid' }); }
};

// --- USER ROUTES ---

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
        
        user.balance -= amount;
        await user.save();

        const withdrawal = new Withdrawal({ userId, amount, bankDetails });
        await withdrawal.save();

        res.status(201).json({ message: 'Withdrawal request submitted successfully!', newBalance: user.balance });
    } catch (err) {
        console.error("--- WITHDRAWAL REQUEST ERROR ---", err);
        res.status(500).json({ message: 'Server error during withdrawal request.' });
    }
});

// POST: User submits a deposit for review
router.post('/submit-deposit', auth, async (req, res) => {
    const { amount, transactionId } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0 || !transactionId) {
        return res.status(400).json({ message: 'Amount and Transaction ID are required.' });
    }

    try {
        const existingDeposit = await Deposit.findOne({ transactionId });
        if (existingDeposit) {
            return res.status(400).json({ message: 'This Transaction ID has already been submitted.' });
        }
        
        const deposit = new Deposit({ userId, amount, transactionId });
        await deposit.save();
        
        res.status(201).json({ message: 'Deposit request submitted for admin review!' });
    } catch (err) {
        console.error("--- DEPOSIT SUBMISSION ERROR ---", err);
        res.status(500).json({ message: 'Server error during deposit submission.' });
    }
});


// This is the line that was missing
module.exports = router;
