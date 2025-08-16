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
const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret";

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- GLOBAL VARIABLES & GAME STATES ---
let connectedUsers = {}; // Maps userId to socket.id

// Color Arena State
let colorArenaState = { timer: 20, phase: 'waiting', winningColor: null, history: [] };
let colorArenaBets = {}; // { userId: [ {bet1}, {bet2} ], ... }

// Aviator State
let aviatorState = { phase: 'waiting', multiplier: 1.00, startTime: null, crashPoint: null };
let aviatorBets = {}; // { userId: { betAmount, status: 'playing' | 'cashed_out', cashOutMultiplier } }

// --- COLOR ARENA ENGINE ---

const registerColorBet = (userId, betAmount, chosenColor) => {
    if (colorArenaState.phase !== 'betting') return; // Ignore bets outside the betting window
    if (!colorArenaBets[userId]) {
        colorArenaBets[userId] = [];
    }
    colorArenaBets[userId].push({ betAmount, chosenColor });
};
app.set('registerColorBet', registerColorBet); // Attach to app for routes to use

// Color Arena Game Loop (runs every 15 seconds)
setInterval(() => {
    if (colorArenaState.phase === 'betting') {
        colorArenaState.phase = 'result';
        colorArenaState.timer = 5;
        const colors = ['red', 'green', 'blue'];
        colorArenaState.winningColor = colors[Math.floor(Math.random() * colors.length)];
        colorArenaState.history.unshift(colorArenaState.winningColor);
        if (colorArenaState.history.length > 20) colorArenaState.history.pop();
        processColorPayouts(colorArenaState.winningColor);
    } else {
        colorArenaState.phase = 'betting';
        colorArenaState.timer = 15;
        colorArenaBets = {};
    }
}, 15000);

// Color Arena Countdown (runs every 1 second)
setInterval(() => {
    colorArenaState.timer--;
    io.emit('colorArenaState', colorArenaState);
}, 1000);

async function processColorPayouts(winningColor) {
    for (const userId in colorArenaBets) {
        let totalWinnings = 0;
        for (const bet of colorArenaBets[userId]) {
            if (bet.chosenColor === winningColor) {
                totalWinnings += bet.betAmount * 2;
            }
        }
        if (totalWinnings > 0) {
            try {
                const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: totalWinnings } }, { new: true });
                if (connectedUsers[userId]) {
                    io.to(connectedUsers[userId]).emit('balanceUpdate', { newBalance: updatedUser.balance });
                }
            } catch (err) { console.error(`Color Payout Error for user ${userId}:`, err); }
        }
    }
}


// --- AVIATOR ENGINE ---

const adminCrashAviator = () => {
    if (aviatorState.phase === 'playing') {
        aviatorState.crashPoint = aviatorState.multiplier; // Set crash point to current multiplier
    }
};
app.set('adminCrashAviator', adminCrashAviator); // Attach for admin route

// Aviator Game Loop (runs 10 times per second for smoothness)
setInterval(() => {
    if (aviatorState.phase === 'playing') {
        if (aviatorState.multiplier >= aviatorState.crashPoint) {
            aviatorState.phase = 'crashed';
            io.emit('aviatorState', aviatorState);
        } else {
            const elapsed = (Date.now() - aviatorState.startTime) / 1000;
            aviatorState.multiplier = parseFloat(Math.pow(1.05, elapsed).toFixed(2));
            io.emit('aviatorState', aviatorState);
        }
    } else if (aviatorState.phase === 'crashed' || aviatorState.phase === 'waiting') {
        // Start a new round after a pause
        aviatorState.phase = 'pending'; // A brief moment before 'waiting'
        aviatorState.multiplier = 1.00;
        aviatorBets = {};
        aviatorState.crashPoint = parseFloat((Math.random() * 10 + 1.1).toFixed(2));
        aviatorState.startTime = Date.now() + 5000;
        io.emit('aviatorState', { phase: 'waiting', startTime: aviatorState.startTime });
        
        setTimeout(() => {
            aviatorState.phase = 'playing';
        }, 5000);
    }
}, 100);


// --- SOCKET.IO CONNECTION HANDLING ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('authenticate', (token) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.userId) {
                connectedUsers[decoded.userId] = socket.id;
                console.log(`Authenticated: User ${decoded.userId} -> Socket ${socket.id}`);
            }
        } catch (err) { /* silent fail on bad token */ }
    });

    socket.on('disconnect', () => {
        for (const userId in connectedUsers) {
            if (connectedUsers[userId] === socket.id) {
                delete connectedUsers[userId];
                break;
            }
        }
        console.log('User disconnected:', socket.id);
    });
});


// --- SERVER STARTUP ---
async function startServer() {
    if (!dbURI) {
        console.error('FATAL ERROR: DATABASE_URL environment variable is not set!');
        return process.exit(1);
    }
    try {
        await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ MongoDB Connected!');
        
        // Load API Routes
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));
        app.use('/api/transaction', require('./routes/transaction'));
        app.use('/api/admin', require('./routes/admin'));
        // We will create aviator routes later, for now this structure is ready
        // app.use('/api/aviator', require('./routes/aviator'));

        server.listen(PORT, () => {
            console.log(`🚀 Server is live on port ${PORT}`);
        });

    } catch (err) {
        console.error('❌ CRITICAL STARTUP ERROR:', err);
        process.exit(1);
    }
}

startServer();
