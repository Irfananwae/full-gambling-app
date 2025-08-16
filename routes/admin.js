// ... (keep the top part with adminAuth middleware) ...

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
        const withdrawal = await Withdrawal.findByIdAndUpdate(withdrawalId, { status: 'approved' }, { new: true });
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
        const withdrawal = await Withdrawal.findByIdAndUpdate(withdrawalId, { status: 'rejected' }, { new: true });
        if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found.' });
        
        // Refund the money to the user's balance
        await User.findByIdAndUpdate(withdrawal.userId, { $inc: { balance: withdrawal.amount } });
        
        res.json({ message: 'Withdrawal rejected and funds returned to user.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// ... (keep your existing /users and /add-balance routes) ...
