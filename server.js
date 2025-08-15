require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors({
    origin: "*", // you can replace "*" with your frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json()); // JSON body parser
app.use(express.urlencoded({ extended: true })); // for form-data
app.use(express.static('public'));

// --- Connect to MongoDB ---
const dbURI = process.env.DATABASE_URL;

async function startServer() {
    try {
        if (!dbURI) throw new Error("❌ DATABASE_URL is not set in environment variables");

        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB Connected');

        // --- Load Routes AFTER DB connection ---
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));

        // --- Start server ---
        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    }
}

startServer();
