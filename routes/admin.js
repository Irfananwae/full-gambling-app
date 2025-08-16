const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

// --- Middleware to verify the user is an Admin ---
const adminAuth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // --- THIS IS THE CRITICAL CHECK ---
        // It looks inside the decoded token for the 'isAdmin' flag.
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: 'Access denied. User is not an admin.' });
        }
        // --- END OF CRITICAL CHECK ---

        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ message: 'Token is not valid' });
    }
};

// --- Admin Routes (No changes needed here) ---

// GET: Fetch all users' data
router.get('/users', adminAuth, async (req, res) => {
    // ... your existing /users route ...
});

// POST: Add money to a user's account
router.post('/add-balance', adminAuth, async (req, res) => {
    // ... your existing /add-balance route ...
});


module.exports = router;
