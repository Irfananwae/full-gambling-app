require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const dbURI = process.env.DATABASE_URL;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

async function startServer() {
    if (!dbURI) {
        console.error('FATAL ERROR: DATABASE_URL is not set!');
        return process.exit(1);
    }
    try {
        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB Connected Successfully!');

        // Load routes AFTER the connection is good
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));

        server.listen(PORT, () => {
            console.log(`🚀 Server is live on port ${PORT}`);
        });

    } catch (err) {
        console.error('❌ CRITICAL: Could not connect to MongoDB on startup.', err);
        process.exit(1);
    }
}

startServer();
