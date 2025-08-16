const express = require('express');
const router = express.Router(); // This line creates the router
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

const adminAuth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Not an admin.' });
        }
        req.user = decoded;
        next();
    } catch (e) { res.status(400).json({ message: 'Token is not valid' }); }
};

router.get('/users', adminAuth, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) { res.status(500).json({ message: 'Server error fetching users' }); }
});

router.post('/add-balance', adminAuth, async (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'User ID and a valid amount are required.' });
    }
    try {
        const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: Number(amount) } }, { new: true }).select('-password');
        if (!updatedUser) return res.status(404).json({ message: 'User not found.' });
        res.json({ message: `Successfully added ${amount} to user.`, user: updatedUser });
    } catch (err) { res.status(500).json({ message: 'Server error updating balance' }); }
});

router.get('/withdrawals', adminAuth, async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ status: 'pending' }).populate('userId', 'email');
        res.json(withdrawals);
    } catch (err) { res.status(500).json({ message: 'Server error fetching withdrawals' }); }
});

router.post('/approve-withdrawal', adminAuth, async (req, res) => {
    const { withdrawalId } = req.body;
    try {
        const withdrawal = await Withdrawal.findByIdAndUpdate(withdrawalId, { status: 'approved' }, { new: true });
        if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found.' });
        res.json({ message: 'Withdrawal approved.' });
    } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

router.post('/reject-withdrawal', adminAuth, async (req, res) => {
    const { withdrawalId } = req.body;
    try {
        const withdrawal = await Withdrawal.findByIdAndUpdate(withdrawalId, { status: 'rejected' }, { new: true });
        if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found.' });
        await User.findByIdAndUpdate(withdrawal.userId, { $inc: { balance: withdrawal.amount } });
        res.json({ message: 'Withdrawal rejected and funds returned to user.' });
    } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

module.exports = router;
