const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    bankDetails: {
        accountHolder: { type: String, required: true },
        accountNumber: { type: String, required: true },
        ifscCode: { type: String, required: true }
    },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
