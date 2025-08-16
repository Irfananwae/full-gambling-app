require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express(); // The 'app' object is created here
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
let connectedUsers = {};

const registerBet = (userId, betAmount, chosenColor) => {
    pendingBets[userId] = { betAmount, chosenColor };
};

// --- THIS IS THE CRITICAL CHANGE ---
// We are attaching the function to the app object, making it globally accessible in our routes.
app.set('registerBet', registerBet);
// --- END OF CRITICAL CHANGE ---

// --- GAME LOOP AND OTHER LOGIC (No changes needed here) ---
// ... (The two setInterval functions and processPayouts function are exactly the same) ...

io.on('connection', (socket) => {
    // ... (socket connection logic is the same) ...
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
// Note: I have removed the module.exports line from this file as it is no longer needed.
