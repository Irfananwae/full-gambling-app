const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Deposit = require('../models/Deposit'); // We need this model
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

// --- Middleware to verify the user is an Admin ---
const adminAuth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Not an admin.' });
        }
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ message: 'Token is not valid' });
    }
};

// --- USER MANAGEMENT ROUTES ---

// GET: Fetch all users' data
router.get('/users', adminAuth, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

// POST: Add money to a user's account
router.post('/add-balance', adminAuth, async (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'User ID and a valid amount are required.' });
    }
    try {
        const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: Number(amount) } }, { new: true }).select('-password');
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ message: `Successfully added ${amount} to user.`, user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: 'Server error updating balance' });
    }
});

// --- DEPOSIT MANAGEMENT ROUTES ---

// GET: Fetch all pending deposit requests
router.get('/deposits', adminAuth, async (req, res) => {
    try {
        const deposits = await Deposit.find({ status: 'pending' }).populate('userId', 'email');
        res.json(deposits);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching deposits' });
    }
});

// POST: Approve a deposit and add funds
router.post('/approve-deposit', adminAuth, async (req, res) => {
    const { depositId } = req.body;
    try {
        const deposit = await Deposit.findById(depositId);
        if (!deposit || deposit.status !== 'pending') {
            return res.status(404).json({ message: 'Deposit not found or already processed.' });
        }
        await User.findByIdAndUpdate(deposit.userId, { $inc: { balance: deposit.amount } });
        deposit.status = 'approved';
        await deposit.save();
        res.json({ message: `Deposit approved. ₹${deposit.amount} added to user.` });
    } catch (err) {
        res.status(500).json({ message: 'Server error approving deposit.' });
    }
});

// POST: Reject a deposit
router.post('/reject-deposit', adminAuth, async (req, res) => {
    const { depositId } = req.body;
    try {
        const deposit = await Deposit.findByIdAndUpdate(depositId, { status: 'rejected' });
        if (!deposit) return res.status(404).json({ message: 'Deposit not found.' });
        res.json({ message: 'Deposit rejected.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error rejecting deposit.' });
    }
});


// --- WITHDRAWAL MANAGEMENT ROUTES ---

// GET: Fetch all withdrawal requests
router.get('/withdrawals', adminAuth, async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ status: 'pending' }).populate('userId', 'email');
        res.json(withdrawals);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching withdrawals' });
    }
});

// POST: Approve a withdrawal (marks as complete)
router.post('/approve-withdrawal', adminAuth, async (req, res) => {
    const { withdrawalId } = req.body;
    try {
        const withdrawal = await Withdrawal.findByIdAndUpdate(withdrawalId, { status: 'approved' });
        if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found.' });
        res.json({ message: 'Withdrawal approved.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST: Reject a withdrawal (refunds the money to the user)
router.post('/reject-withdrawal', adminAuth, async (req, res) => {
    const { withdrawalId } = req.body;
    try {
        const withdrawal = await Withdrawal.findByIdAndUpdate(withdrawalId, { status: 'rejected' });
        if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found.' });
        await User.findByIdAndUpdate(withdrawal.userId, { $inc: { balance: withdrawal.amount } });
        res.json({ message: 'Withdrawal rejected and funds returned to user.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// This is the line that was missing
module.exports = router;
