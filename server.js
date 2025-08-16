// Only the absolute safest 'require' is outside.
require('dotenv').config();

// All other imports will be moved inside the try block.

async function startServer() {
    try {
        // --- BLACK BOX RECORDER START ---
        console.log("[DIAGNOSTIC] Stage 1: Initializing server...");

        const express = require('express');
        const mongoose = require('mongoose');
        const cors = require('cors');
        const http = require('http');
        const { Server } = require("socket.io");
        const jwt = require('jsonwebtoken');

        console.log("[DIAGNOSTIC] Stage 2: Loading database models...");
        const User = require('./models/User');
        const Withdrawal = require('./models/Withdrawal');
        const Deposit = require('./models/Deposit');
        
        const app = express();
        const server = http.createServer(app);
        const io = new Server(server, { cors: { origin: "*" } });

        const PORT = process.env.PORT || 3000;
        const dbURI = process.env.DATABASE_URL;
        const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

        app.use(cors());
        app.use(express.json());
        app.use(express.static('public'));

        // Your game logic functions (no change)
        let connectedUsers = {};
        const registerBet = (userId, betAmount, chosenColor) => { /* ... */ };
        app.set('registerBet', registerBet);
        // ... and all your other game logic ...

        if (!dbURI) {
            // This will now be caught by our main catch block
            throw new Error('FATAL ERROR: DATABASE_URL environment variable is not set!');
        }

        console.log("[DIAGNOSTIC] Stage 3: Attempting to connect to MongoDB...");
        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 20000 // Increase timeout
        });
        console.log('✅ MongoDB Connected Successfully!');

        console.log("[DIAGNOSTIC] Stage 4: Loading API routes...");
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));
        app.use('/api/transaction', require('./routes/transaction'));
        app.use('/api/admin', require('./routes/admin'));
        app.use('/api/aviator', require('./routes/aviator'));

        io.on('connection', (socket) => {
            console.log('User connected via WebSocket:', socket.id);
            // ... your socket logic ...
        });

        console.log(`[DIAGNOSTIC] Stage 5: Attempting to bind to PORT ${PORT}...`);
        server.listen(PORT, () => {
            console.log(`🚀🚀🚀 SERVER IS LIVE and listening on port ${PORT}! 🚀🚀🚀`);
        });

    } catch (err) {
        // --- THIS IS THE MOST IMPORTANT PART ---
        console.error("🔥🔥🔥 FATAL STARTUP CRASH 🔥🔥🔥");
        console.error("The application failed to start. This is the reason:");
        console.error(err); // This will print the exact error, whatever it is.
        process.exit(1); // Ensure the process stops on failure
    }
}

// Start the entire process
startServer();
