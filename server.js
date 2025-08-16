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

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let gameState = { timer: 20, phase: 'waiting', winningColor: null, history: [] };
let pendingBets = {};
let connectedUsers = {};

const registerBet = (userId, betAmount, chosenColor) => {
    pendingBets[userId] = { betAmount, chosenColor };
};
app.set('registerBet', registerBet); // Attach to the app object

setInterval(() => {
    if (gameState.phase === 'betting') {
        gameState.phase = 'result';
        gameState.timer = 5;
        const colors = ['red', 'green', 'blue'];
        gameState.winningColor = colors[Math.floor(Math.random() * colors.length)];
        gameState.history.unshift(gameState.winningColor);
        if (gameState.history.length > 20) gameState.history.pop();
        processPayouts(gameState.winningColor);
    } else {
        gameState.phase = 'betting';
        gameState.timer = 15;
        pendingBets = {};
    }
}, 15000);

setInterval(() => {
    gameState.timer--;
    io.emit('gameState', gameState);
}, 1000);

async function processPayouts(winningColor) {
    for (const userId in pendingBets) {
        const bet = pendingBets[userId];
        if (bet.chosenColor === winningColor) {
            try {
                const winnings = bet.betAmount * 2;
                const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { balance: winnings } }, { new: true });
                if (connectedUsers[userId]) {
                    io.to(connectedUsers[userId]).emit('balanceUpdate', { newBalance: updatedUser.balance });
                }
            } catch (err) { console.error(`Payout Error for user ${userId}:`, err); }
        }
    }
}

io.on('connection', (socket) => {
    socket.on('authenticate', (token) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            connectedUsers[decoded.userId] = socket.id;
        } catch (err) { /* silent fail */ }
    });
    socket.on('disconnect', () => {
        for (const userId in connectedUsers) {
            if (connectedUsers[userId] === socket.id) {
                delete connectedUsers[userId];
                break;
            }
        }
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
        server.listen(PORT, () => { console.log(`🚀 Server is live on port ${PORT}`); });
    } catch (err) { console.error('❌ CRITICAL STARTUP ERROR:', err); process.exit(1); }
}
startServer();
