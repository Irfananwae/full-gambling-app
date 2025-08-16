const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

// --- Middleware to verify the user is an Admin ---
const adminAuth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // CRITICAL: Check if the user is an admin
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Not an admin.' });
        }
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ message: 'Token is not valid' });
    }
};

// --- Admin Routes ---

// GET: Fetch all users' data
router.get('/users', adminAuth, async (req, res) => {
    try {
        // Find all users but exclude their passwords for security
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
        // Use findByIdAndUpdate with $inc to safely add to the balance
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $inc: { balance: Number(amount) } },
            { new: true } // This option returns the updated document
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ message: `Successfully added ${amount} to user.`, user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: 'Server error updating balance' });
    }
});


module.exports = router;
