require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors =require('cors');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const dbURI = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- GLOBAL VARIABLES & GAME STATES ---
let connectedUsers = {};
// Color Arena State
let colorArenaState = { timer: 20, phase: 'waiting', winningColor: null, history: [] };
let colorArenaBets = {};
// Aviator State
let aviatorState = { phase: 'waiting', multiplier: 1.00, startTime: null, crashPoint: null, history: [] };
let aviatorBets = {}; // { userId: { panel1: { bet, status }, panel2: { bet, status } } }

// --- COLOR ARENA ENGINE (No changes needed) ---
// ... (All the Color Arena setIntervals and functions remain here) ...

// --- AVIATOR ENGINE ---
const placeAviatorBet = (userId, betAmount, betPanelId) => {
    if (aviatorState.phase !== 'waiting') {
        return { success: false, message: 'Bets are closed for this round.' };
    }
    if (!aviatorBets[userId]) aviatorBets[userId] = {};
    if (aviatorBets[userId][betPanelId]) {
        return { success: false, message: 'You have already placed a bet on this panel.' };
    }
    aviatorBets[userId][betPanelId] = { betAmount, status: 'playing' };
    io.emit('aviatorNewBet', { email: connectedUsers[userId]?.email || 'Player', betAmount });
    return { success: true };
};
app.set('placeAviatorBet', placeAviatorBet);

const cashOutAviator = async (userId, betPanelId) => {
    if (aviatorState.phase !== 'playing' || !aviatorBets[userId] || !aviatorBets[userId][betPanelId] || aviatorBets[userId][betPanelId].status !== 'playing') {
        return { success: false, message: 'Unable to cash out.' };
    }
    const bet = aviatorBets[userId][betPanelId];
    const cashOutMultiplier = aviatorState.multiplier;
    const winnings = bet.betAmount * cashOutMultiplier;
    
    bet.status = 'cashed_out';
    bet.cashOutMultiplier = cashOutMultiplier;

    const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: winnings } }, { new: true });
    if (connectedUsers[userId]) {
        io.to(connectedUsers[userId]).emit('balanceUpdate', { newBalance: updatedUser.balance });
    }
    return { success: true, multiplier: cashOutMultiplier, newBalance: updatedUser.balance };
};
app.set('cashOutAviator', cashOutAviator);

setInterval(() => {
    if (aviatorState.phase === 'playing') {
        if (aviatorState.multiplier >= aviatorState.crashPoint) {
            aviatorState.phase = 'crashed';
            aviatorState.history.unshift({ multiplier: aviatorState.multiplier, color: 'crashed' });
            if(aviatorState.history.length > 20) aviatorState.history.pop();
            io.emit('aviatorState', aviatorState);
        } else {
            const elapsed = (Date.now() - aviatorState.startTime) / 1000;
            aviatorState.multiplier = parseFloat(Math.pow(1.05, elapsed).toFixed(2));
            io.emit('aviatorState', { phase: 'playing', multiplier: aviatorState.multiplier });
        }
    } else if (aviatorState.phase === 'crashed' || aviatorState.phase === 'waiting') {
        aviatorState.phase = 'pending';
        
        // --- ADVANCED CRASH LOGIC ---
        const totalBets = Object.keys(aviatorBets).reduce((sum, userId) => sum + Object.keys(aviatorBets[userId]).length, 0);
        let crashPoint;
        if (totalBets > 100) {
            // High pressure: crash point is very low
            crashPoint = parseFloat((Math.random() * 0.5 + 1.01).toFixed(2)); // Crashes between 1.01x and 1.51x
        } else {
            // Normal pressure
            crashPoint = Math.random() < 0.1 ? 1.00 : parseFloat((Math.random() * 10 + 1.1).toFixed(2));
        }
        // --- END ADVANCED CRASH LOGIC ---

        aviatorBets = {};
        aviatorState.crashPoint = crashPoint;
        aviatorState.startTime = Date.now() + 8000;
        io.emit('aviatorState', { phase: 'waiting', startTime: aviatorState.startTime, history: aviatorState.history });
        
        setTimeout(() => {
            aviatorState.phase = 'playing';
            aviatorState.startTime = Date.now();
        }, 8000);
    }
}, 100);

// --- SOCKET.IO & SERVER STARTUP ---
io.on('connection', (socket) => {
    // ... (Your existing socket connection logic is fine)
});

async function startServer() {
    if (!dbURI) { /* ... */ }
    try {
        await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ MongoDB Connected!');
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));
        app.use('/api/transaction', require('./routes/transaction'));
        app.use('/api/admin', require('./routes/admin'));
        app.use('/api/aviator', require('./routes/aviator')); // <-- ADD THIS NEW ROUTE
        server.listen(PORT, () => { console.log(`🚀 Server is live on port ${PORT}`); });
    } catch (err) { /* ... */ }
}
startServer();     
