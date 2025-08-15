const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Database Connection ---
const dbURI = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/mydb';

// --- Game State (In-memory) ---
let gameTimer = 15;
let currentRoundId = null;
const botNames = ["AlphaBot", "BetaZero", "GamerX", "ProPlayer", "LuckyBot"];

// --- Real-time Game Logic ---
function runGameCycle() {
    currentRoundId = `ROUND-${Date.now()}`;
    gameTimer = 15;

    // Countdown phase
    const countdownInterval = setInterval(() => {
        gameTimer--;
        
        // Generate some fake AI bot bets
        const bots = botNames.map(name => ({
            name: name,
            bet: (Math.random() * 100).toFixed(2),
            color: ['red', 'green', 'blue'][Math.floor(Math.random() * 3)]
        }));
        
        io.emit('gameState', { timer: gameTimer, phase: 'betting', bots });

        if (gameTimer <= 0) {
            clearInterval(countdownInterval);
            // Result phase
            const winningColor = ['red', 'green', 'blue'][Math.floor(Math.random() * 3)];
            io.emit('gameState', { timer: 5, phase: 'result', winningColor });

            // Wait 5 seconds before starting a new round
            setTimeout(runGameCycle, 5000);
        }
    }, 1000);
}


async function startServer() {
    try {
        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB Connected');

        // Load API routes
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));
        
        // Handle Socket.IO connections
        io.on('connection', (socket) => {
            console.log('A user connected:', socket.id);
            socket.on('disconnect', () => {
                console.log('User disconnected:', socket.id);
            });
        });
        
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            runGameCycle(); // Start the first game round
        });

    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    }
}

startServer();
