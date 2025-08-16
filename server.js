require('dotenv').config(); // Loads environment variables from a .env file if it exists

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json()); // This is crucial for parsing the body of requests
app.use(express.static('public'));

// --- Database Connection ---
// This line reads the secret key from Render's environment variables
const dbURI = process.env.DATABASE_URL;

async function startServer() {
    if (!dbURI) {
        console.error('FATAL ERROR: DATABASE_URL environment variable is not set!');
        process.exit(1); // Stop the server if the key is missing
    }

    try {
        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000 // Increased timeout for Render's cold start
        });
        console.log('✅ MongoDB Connected Successfully!');

        // API routes are loaded AFTER the connection is established
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));

        io.on('connection', (socket) => {
            console.log('A user connected via WebSocket:', socket.id);
        });

        server.listen(PORT, () => {
            console.log(`🚀 Server is live and listening on port ${PORT}`);
            // If you have a game cycle function, you can start it here.
        });

    } catch (err) {
        console.error('❌ CRITICAL: Could not connect to MongoDB.', err);
        process.exit(1); // Stop the server if the DB connection fails on startup
    }
}

startServer();
