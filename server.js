const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // Required for Socket.IO
const { Server } = require("socket.io"); // Required for Socket.IO

const app = express();
const server = http.createServer(app); // Create an HTTP server from the Express app
const io = new Server(server, { // Attach Socket.IO to the HTTP server
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// --- CRITICAL MIDDLEWARE ORDER ---
// 1. CORS must be first to allow cross-origin requests.
app.use(cors());
// 2. The JSON parser MUST be next to process the body of POST requests.
app.use(express.json());
// 3. The static file server is next.
app.use(express.static('public'));
// --- END OF CRITICAL ORDER ---

// --- Database Connection ---
const dbURI = process.env.DATABASE_URL; // Using the Render Environment Variable

// --- Game State (You can keep your game logic here) ---
// ... (Your game logic like runGameCycle, etc. remains here) ...

async function startServer() {
    if (!dbURI) {
        console.error('❌ DATABASE_URL environment variable is not set!');
        process.exit(1);
    }
    
    try {
        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB Connected');

        // 4. API routes are loaded LAST, after all middleware is set up.
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));

        // Handle Socket.IO connections
        io.on('connection', (socket) => {
            console.log('A user connected:', socket.id);
        });
        
        // Use the 'server' object to listen, not 'app'
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            // If you have a game cycle, start it here
            // runGameCycle(); 
        });

    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    }
}

startServer();
