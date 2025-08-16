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
    
    // --- THIS IS THE NEW LINE ---
    // We get the user's email from the connectedUsers map
    const userEmail = (Object.entries(connectedUsers).find(([id, sockId]) => id === userId) || [])[0];
    
    // Now we emit the bet with the email
    io.emit('aviatorNewBet', { email: userEmail || 'Player', betAmount });
    // --- END OF NEW LINE ---

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
// --- GALAXY SPIN BATTLE ENGINE ---
let galaxyBattleState = {
    phase: 'waiting', // waiting, spinning, result
    timer: 60, // 60 seconds to join a battle
    jackpot: 0,
    players: {}, // { userId: { email } }
    winner: null,
    entryFee: 50 // The cost to enter a battle
};

const joinGalaxyBattle = (userId, email) => {
    if (galaxyBattleState.phase !== 'waiting') {
        return { success: false, message: 'The battle has already started!' };
    }
    if (galaxyBattleState.players[userId]) {
        return { success: false, message: 'You have already joined this battle.' };
    }
    galaxyBattleState.players[userId] = { email: email.split('@')[0] };
    galaxyBattleState.jackpot += galaxyBattleState.entryFee;
    io.emit('galaxyBattleState', galaxyBattleState); // Update everyone
    return { success: true };
};
app.set('joinGalaxyBattle', joinGalaxyBattle); // Attach for the API route to use

// Galaxy Battle Game Loop (runs every second)
setInterval(() => {
    if (galaxyBattleState.phase === 'waiting') {
        galaxyBattleState.timer--;
        if (galaxyBattleState.timer <= 0 || Object.keys(galaxyBattleState.players).length >= 10) { // Start if timer ends or 10 players join
            galaxyBattleState.phase = 'spinning';
            galaxyBattleState.timer = 10; // 10 second spin/result phase
            io.emit('galaxyBattleState', galaxyBattleState);
        }
    } else if (galaxyBattleState.phase === 'spinning') {
        galaxyBattleState.timer--;
        if (galaxyBattleState.timer <= 0) {
            galaxyBattleState.phase = 'result';
            galaxyBattleState.timer = 5; // 5 seconds to show winner
            
            // --- Determine Winner and Payout ---
            const playerIds = Object.keys(galaxyBattleState.players);
            if (playerIds.length > 0) {
                const winnerId = playerIds[Math.floor(Math.random() * playerIds.length)];
                const houseCut = galaxyBattleState.jackpot * 0.10; // 10% house edge
                const winnerPayout = galaxyBattleState.jackpot - houseCut;
                
                galaxyBattleState.winner = { email: galaxyBattleState.players[winnerId].email, payout: winnerPayout };
                
                // Award winnings to the winner
                User.findByIdAndUpdate(winnerId, { $inc: { balance: winnerPayout } }).then(updatedUser => {
                    if (updatedUser && connectedUsers[winnerId]) {
                        io.to(connectedUsers[winnerId]).emit('balanceUpdate', { newBalance: updatedUser.balance });
                    }
                });
            } else {
                galaxyBattleState.winner = { email: 'No one joined!', payout: 0 };
            }
            io.emit('galaxyBattleState', galaxyBattleState);
        }
    } else if (galaxyBattleState.phase === 'result') {
        galaxyBattleState.timer--;
        if (galaxyBattleState.timer <= 0) {
            // Reset for the next round
            galaxyBattleState.phase = 'waiting';
            galaxyBattleState.timer = 60;
            galaxyBattleState.jackpot = 0;
            galaxyBattleState.players = {};
            galaxyBattleState.winner = null;
            io.emit('galaxyBattleState', galaxyBattleState);
        }
    }
}, 1000);

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
        app.use('/api/galaxy', require('./routes/galaxy'));
        app.use('/api/transaction', require('./routes/transaction'));
        app.use('/api/admin', require('./routes/admin'));
        app.use('/api/aviator', require('./routes/aviator')); // <-- ADD THIS NEW ROUTE
        server.listen(PORT, () => { console.log(`🚀 Server is live on port ${PORT}`); });
    } catch (err) { /* ... */ }
}
startServer();     
