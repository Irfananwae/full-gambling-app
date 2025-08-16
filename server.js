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

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let gameState = { timer: 20, phase: 'waiting', winningColor: null, history: [] };
let pendingBets = {};
let connectedUsers = {}; // Maps userId to socket.id

// --- THE GAME LOOP ---
setInterval(() => {
    if (gameState.phase === 'betting') { // Round ends, calculate result
        gameState.phase = 'result';
        gameState.timer = 5;
        const colors = ['red', 'green', 'blue'];
        gameState.winningColor = colors[Math.floor(Math.random() * colors.length)];
        gameState.history.unshift(gameState.winningColor); // Add to history
        if (gameState.history.length > 20) gameState.history.pop(); // Keep history short
        processPayouts(gameState.winningColor);
    } else { // New round starts
        gameState.phase = 'betting';
        gameState.timer = 15;
        pendingBets = {};
    }
}, 15000); // Betting phase is 15 seconds

// --- The 1-Second Countdown Timer ---
setInterval(() => {
    gameState.timer--;
    io.emit('gameState', gameState); // Broadcast state every second
}, 1000);

async function processPayouts(winningColor) {
    for (const userId in pendingBets) {
        const bet = pendingBets[userId];
        if (bet.chosenColor === winningColor) {
            try {
                const winnings = bet.betAmount * 2; // Payout is 2x
                const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: winnings } }, { new: true });
                
                // If the winning user is online, send them a real-time balance update
                if (connectedUsers[userId]) {
                    io.to(connectedUsers[userId]).emit('balanceUpdate', { newBalance: updatedUser.balance });
                }
            } catch (err) { console.error(`Payout Error for user ${userId}:`, err); }
        }
    }
}

// Share the betting function with the API routes
app.set('registerBet', (userId, betAmount, chosenColor) => {
    pendingBets[userId] = { betAmount, chosenColor };
});

// --- REAL-TIME SOCKET CONNECTION HANDLING ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    // Authenticate the user's connection
    socket.on('authenticate', (token) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            connectedUsers[decoded.userId] = socket.id;
            console.log(`User ${decoded.userId} authenticated with socket ${socket.id}`);
        } catch (err) { console.log('Socket authentication failed'); }
    });
    socket.on('disconnect', () => {
        // Remove user from the map on disconnect
        for (const userId in connectedUsers) {
            if (connectedUsers[userId] === socket.id) {
                delete connectedUsers[userId];
                break;
            }
        }
        console.log('A user disconnected:', socket.id);
    });
});

// --- Server Startup ---
async function startServer() {
    if (!dbURI) { console.error('FATAL ERROR!'); process.exit(1); }
    try {
        await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ MongoDB Connected!');
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));
        app.use('/api/transaction', require('./routes/transaction'));
        app.use('/api/admin', require('./routes/admin'));
        server.listen(PORT, () => { console.log(`🚀 Server is live on port ${PORT}`); });
    } catch (err) { console.error('❌ CRITICAL STARTUP ERROR:', err); process.exit(1); }
}
startServer();
