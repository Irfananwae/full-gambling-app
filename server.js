const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Database Connection ---
const dbURI = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/mydb'; // fallback local URI

async function startServer() {
    try {
        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB Connected');

        // Load routes AFTER connection is established
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/game', require('./routes/game'));

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1); // stop server if DB fails
    }
}

startServer();
