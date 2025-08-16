require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const dbURI = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

app.use(cors()); app.use(express.json()); app.use(express.static('public'));
let connectedUsers = {};

// --- AVIATOR GAME STATE ---
let aviatorState = {
    phase: 'pending', // pending, waiting, playing, crashed
    multiplier: 1.00,
    startTime: null,
    crashPoint: null,
    history: [], // Stores last 10 multipliers
    bets: {} // { userId: { panel1: { bet, status }, panel2: { bet, status } } }
};

// --- AVIATOR GAME LOGIC ---
const placeAviatorBet = (userId, betAmount, betPanelId, userEmail) => {
    if (aviatorState.phase !== 'waiting') return { success: false, message: 'Bets are closed for this round.' };
    if (!aviatorState.bets[userId]) aviatorState.bets[userId] = {};
    if (aviatorState.bets[userId][betPanelId]) return { success: false, message: 'You have already placed a bet on this panel.' };
    
    aviatorState.bets[userId][betPanelId] = { betAmount, status: 'playing' };
    io.emit('aviatorNewBet', { email: userEmail.split('@')[0], betAmount });
    return { success: true };
};
app.set('placeAviatorBet', placeAviatorBet);

const cashOutAviator = async (userId, betPanelId) => {
    const aviator = aviatorState;
    if (aviator.phase !== 'playing' || !aviator.bets[userId] || !aviator.bets[userId][betPanelId] || aviator.bets[userId][betPanelId].status !== 'playing') {
        return { success: false, message: 'Unable to cash out now.' };
    }
    const bet = aviator.bets[userId][betPanelId];
    const cashOutMultiplier = aviator.multiplier;
    const winnings = bet.betAmount * cashOutMultiplier;
    
    bet.status = 'cashed_out';
    bet.cashOutMultiplier = cashOutMultiplier;

    const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: winnings } }, { new: true });
    if (connectedUsers[userId]) {
        io.to(connectedUsers[userId].socketId).emit('balanceUpdate', { newBalance: updatedUser.balance });
    }
    io.emit('aviatorCashOut', { email: connectedUsers[userId]?.email.split('@')[0] || 'Player', cashOutMultiplier });
    return { success: true, multiplier: cashOutMultiplier, newBalance: updatedUser.balance };
};
app.set('cashOutAviator', cashOutAviator);

// --- MASTER AVIATOR GAME LOOP ---
setInterval(() => {
    const aviator = aviatorState;
    if (aviator.phase === 'playing') {
        if (aviator.multiplier >= aviator.crashPoint) {
            aviator.phase = 'crashed';
            aviator.history.unshift(aviator.multiplier);
            if (aviator.history.length > 10) aviator.history.pop();
            io.emit('aviatorState', { phase: 'crashed', multiplier: aviator.multiplier });
            setTimeout(() => { aviator.phase = 'pending'; }, 5000); // 5s result display
        } else {
            const elapsed = (Date.now() - aviator.startTime) / 1000;
            aviator.multiplier = parseFloat(Math.pow(1.08, elapsed).toFixed(2)); // Faster climb for excitement
            io.emit('aviatorState', { phase: 'playing', multiplier: aviator.multiplier });
        }
    } else if (aviator.phase === 'pending') {
        aviator.phase = 'waiting';
        aviator.bets = {};
        aviator.crashPoint = Math.random() < 0.1 ? 1.00 : parseFloat((Math.random() * 15 + 1.1).toFixed(2));
        aviator.startTime = Date.now() + 5000; // 5 second countdown
        io.emit('aviatorState', { phase: 'waiting', startTime: aviator.startTime, history: aviator.history });
        
        setTimeout(() => {
            aviator.phase = 'playing';
            aviator.startTime = Date.now();
        }, 5000);
    }
}, 1000 / 20); // 20 FPS game loop for smooth updates

// --- SOCKET.IO & SERVER STARTUP ---
io.on('connection', (socket) => {
    socket.on('authenticate', (token) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.userId) {
                connectedUsers[decoded.userId] = { socketId: socket.id, email: decoded.email };
            }
        } catch (err) { /* silent fail */ }
    });
    socket.on('disconnect', () => { /* ... */ });
});

async function startServer() {
    if (!dbURI) { console.error('FATAL ERROR!'); process.exit(1); }
    try {
        await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ MongoDB Connected!');
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));
        app.use('/api/transaction', require('./routes/transaction'));
        app.use('/api/admin', require('./routes/admin'));
        app.use('/api/aviator', require('./routes/aviator'));
        server.listen(PORT, () => { console.log(`🚀 Server is live on port ${PORT}`); });
    } catch (err) { console.error('❌ CRITICAL STARTUP ERROR:', err); process.exit(1); }
}
startServer();
