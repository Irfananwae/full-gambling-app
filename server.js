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

// --- UNIFIED GAME STATE ---
let gameState = {
    aviator: { phase: 'waiting', multiplier: 1.00, startTime: null, crashPoint: null, history: [], bets: {} },
    // You can add other games here, like colorArena
};

// --- AVIATOR LOGIC ---
const placeAviatorBet = (userId, betAmount, betPanelId) => {
    const aviator = gameState.aviator;
    if (aviator.phase !== 'waiting') return { success: false, message: 'Bets are closed.' };
    if (!aviator.bets[userId]) aviator.bets[userId] = {};
    if (aviator.bets[userId][betPanelId]) return { success: false, message: 'Bet already placed.' };
    aviator.bets[userId][betPanelId] = { betAmount, status: 'playing' };
    const userEmail = Object.keys(connectedUsers).find(key => connectedUsers[key].userId === userId);
    io.emit('aviatorNewBet', { email: userEmail ? userEmail.split('@')[0] : 'Player', betAmount });
    return { success: true };
};
app.set('placeAviatorBet', placeAviatorBet);

const cashOutAviator = async (userId, betPanelId) => {
    const aviator = gameState.aviator;
    if (aviator.phase !== 'playing' || !aviator.bets[userId] || !aviator.bets[userId][betPanelId] || aviator.bets[userId][betPanelId].status !== 'playing') {
        return { success: false, message: 'Unable to cash out.' };
    }
    const bet = aviator.bets[userId][betPanelId];
    const cashOutMultiplier = aviator.multiplier;
    const winnings = bet.betAmount * cashOutMultiplier;
    bet.status = 'cashed_out';
    bet.cashOutMultiplier = cashOutMultiplier;
    const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: winnings } }, { new: true });
    if (connectedUsers[userId]) io.to(connectedUsers[userId].socketId).emit('balanceUpdate', { newBalance: updatedUser.balance });
    return { success: true, multiplier: cashOutMultiplier, newBalance: updatedUser.balance };
};
app.set('cashOutAviator', cashOutAviator);

// --- MASTER GAME LOOP (Runs 60 times per second) ---
function tick() {
    // --- AVIATOR TICK LOGIC ---
    const aviator = gameState.aviator;
    if (aviator.phase === 'playing') {
        if (aviator.multiplier >= aviator.crashPoint) {
            aviator.phase = 'crashed';
            aviator.history.unshift({ multiplier: aviator.multiplier, color: 'crashed' });
            if(aviator.history.length > 20) aviator.history.pop();
            io.emit('aviatorState', { phase: 'crashed', multiplier: aviator.multiplier });
            setTimeout(() => { aviator.phase = 'pending_restart'; }, 10000); // 10 second wait
        } else {
            const elapsed = (Date.now() - aviator.startTime) / 1000;
            aviator.multiplier = parseFloat(Math.pow(1.06, elapsed).toFixed(2));
            io.emit('aviatorState', { phase: 'playing', multiplier: aviator.multiplier });
        }
    } else if (aviator.phase === 'pending_restart') {
        aviator.phase = 'waiting';
        aviator.bets = {};
        const totalBets = Object.keys(aviator.bets).reduce((sum, userId) => sum + Object.keys(aviator.bets[userId] || {}).length, 0);
        aviator.crashPoint = totalBets > 100 ? parseFloat((Math.random() * 0.5 + 1.01).toFixed(2)) : Math.random() < 0.1 ? 1.00 : parseFloat((Math.random() * 10 + 1.1).toFixed(2));
        aviator.startTime = Date.now() + 5000;
        io.emit('aviatorState', { phase: 'waiting', startTime: aviator.startTime, history: aviator.history });
        setTimeout(() => { aviator.phase = 'playing'; aviator.startTime = Date.now(); }, 5000);
    }
}
setInterval(tick, 1000 / 60); // 60 FPS Game Loop
setTimeout(() => { gameState.aviator.phase = 'pending_restart'; }, 1000); // Start the first round

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
    socket.on('disconnect', () => {
        for (const userId in connectedUsers) { if (connectedUsers[userId].socketId === socket.id) delete connectedUsers[userId]; }
    });
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
