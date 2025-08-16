require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const User = require('./models/User'); // We need the User model for payouts

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const dbURI = process.env.DATABASE_URL;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Game State (The Live Engine) ---
let gameState = {
    timer: 20,
    phase: 'waiting', // Can be 'waiting', 'betting', or 'result'
    roundId: null,
    winningColor: null,
    bots: []
};
const botNames = ["AlphaBot", "BetaZero", "GamerX", "ProPlayer", "LuckyBot", "DataDragon", "Quantum", "CodeSlinger"];
let pendingBets = {}; // Store user bets for the current round: { userId: { betAmount, chosenColor }, ... }

// --- The Game Loop ---
setInterval(() => {
    // 1. RESULT PHASE (Show winner for 5 seconds)
    if (gameState.phase === 'betting') {
        gameState.phase = 'result';
        gameState.timer = 5;
        const colors = ['red', 'green', 'blue'];
        gameState.winningColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Process payouts for the winning color
        processPayouts(gameState.winningColor);

    // 2. BETTING PHASE (Allow bets for 15 seconds)
    } else {
        gameState.phase = 'betting';
        gameState.timer = 15;
        gameState.roundId = `R-${Date.now()}`;
        pendingBets = {}; // Clear bets for the new round
    }

}, 15000); // The main cycle is 15 seconds long (15 betting + 5 result = 20 total, but we'll manage timing)

// --- Countdown & Bot Generator ---
setInterval(() => {
    gameState.timer--;
    
    // Generate fake AI bot bets during the betting phase
    if (gameState.phase === 'betting' && Math.random() > 0.5) {
        gameState.bots.push({
            name: botNames[Math.floor(Math.random() * botNames.length)],
            bet: (Math.random() * 200 + 10).toFixed(2),
            color: ['red', 'green', 'blue'][Math.floor(Math.random() * 3)]
        });
        if (gameState.bots.length > 8) gameState.bots.shift(); // Keep the list from getting too long
    }

    // Broadcast the updated state to all connected players
    io.emit('gameState', gameState);

}, 1000); // This runs every second

async function processPayouts(winningColor) {
    for (const userId in pendingBets) {
        const bet = pendingBets[userId];
        if (bet.chosenColor === winningColor) {
            try {
                // Award winnings (e.g., 2x the bet amount)
                const winnings = bet.betAmount * 2;
                await User.findByIdAndUpdate(userId, { $inc: { balance: winnings } });
            } catch (err) {
                console.error(`Failed to process payout for user ${userId}:`, err);
            }
        }
    }
}

// Store user bets that come in via the API
function registerBet(userId, betAmount, chosenColor) {
    pendingBets[userId] = { betAmount, chosenColor };
}

// Pass the registerBet function to the route
app.use((req, res, next) => {
    req.registerBet = registerBet;
    next();
});

// --- Server Startup ---
async function startServer() {
    // ... (rest of the startServer function is the same as before, no changes needed here)
    if (!dbURI) { console.error('FATAL ERROR: DATABASE_URL is not set!'); return process.exit(1); }
    try {
        await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ MongoDB Connected Successfully!');
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));
        app.use('/api/transaction', require('./routes/transaction'));
app.use('/api/admin', require('./routes/admin'));
        io.on('connection', (socket) => { console.log('A user connected via WebSocket:', socket.id); });
        server.listen(PORT, () => { console.log(`🚀 Server is live on port ${PORT}`); });
    } catch (err) { console.error('❌ CRITICAL: Could not connect to MongoDB on startup.', err); process.exit(1); }
}
startServer();
