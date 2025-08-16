const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";
const auth = (req, res, next) => { try { req.user = jwt.verify(req.header('x-auth-token'), JWT_SECRET); next(); } catch (e) { res.status(400).json({ message: 'Token is not valid' }); }};

router.post('/place-bet', auth, async (req, res) => {
    const { betAmount, betPanelId } = req.body;
    const { userId, email } = req.user; // Get email from token
    if (!betAmount || betAmount <= 0 || !betPanelId) return res.status(400).json({ message: 'Invalid bet data.' });
    
    const placeAviatorBet = req.app.get('placeAviatorBet');
    try {
        const user = await User.findById(userId);
        if (!user || user.balance < betAmount) return res.status(400).json({ message: 'Insufficient balance.' });
        const result = placeAviatorBet(userId, betAmount, betPanelId, email); // Pass email
        if (!result.success) return res.status(400).json({ message: result.message });
        user.balance -= betAmount;
        await user.save();
        res.json({ message: 'Bet placed!', newBalance: user.balance });
    } catch (err) { res.status(500).json({ message: 'Server error placing bet.' }); }
});

router.post('/cash-out', auth, async (req, res) => {
    const { betPanelId } = req.body;
    const { userId } = req.user;
    const cashOutAviator = req.app.get('cashOutAviator');
    const result = await cashOutAviator(userId, betPanelId);
    if (result.success) res.json({ message: `Cashed out!`, newBalance: result.newBalance, multiplier: result.multiplier });
    else res.status(400).json({ message: result.message });
});

module.exports = router;
