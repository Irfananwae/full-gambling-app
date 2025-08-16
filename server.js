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

app.use(cors()); app.use(express.json()); app.use(express.static('public'));
let connectedUsers = {};

// --- GAME ENGINES ---

// 1. COLOR ARENA ENGINE (No changes, remains stable)
// ... (All your existing, working Color Arena code: states, loops, payouts, etc.) ...

// 2. AVIATOR ENGINE (Completely Overhauled)
let aviatorState = { phase: 'waiting', multiplier: 1.00, startTime: null, crashPoint: null, history: [] };
let aviatorBets = {};
const placeAviatorBet = (userId, betAmount, betPanelId) => { /* ... same as before ... */ };
app.set('placeAviatorBet', placeAviatorBet);
const cashOutAviator = async (userId, betPanelId) => { /* ... same as before ... */ };
app.set('cashOutAviator', cashOutAviator);
const adminCrashAviator = () => { if (aviatorState.phase === 'playing') aviatorState.crashPoint = aviatorState.multiplier; };
app.set('adminCrashAviator', adminCrashAviator);

setInterval(() => {
    if (aviatorState.phase === 'playing') {
        if (aviatorState.multiplier >= aviatorState.crashPoint) {
            aviatorState.phase = 'crashed';
            aviatorState.history.unshift({ multiplier: aviatorState.multiplier, color: 'crashed' });
            if(aviatorState.history.length > 20) aviatorState.history.pop();
            io.emit('aviatorState', aviatorState);
            // PERFECTED 10 SECOND WAIT
            setTimeout(() => { aviatorState.phase = 'waiting_for_new_round'; }, 10000);
        } else {
            const elapsed = (Date.now() - aviatorState.startTime) / 1000;
            aviatorState.multiplier = parseFloat(Math.pow(1.06, elapsed).toFixed(2)); // Slightly faster climb
            io.emit('aviatorState', { phase: 'playing', multiplier: aviatorState.multiplier });
        }
    } else if (aviatorState.phase === 'waiting_for_new_round') {
        aviatorState.phase = 'waiting';
        aviatorBets = {};
        const totalBets = Object.keys(aviatorBets).reduce((sum, userId) => sum + Object.keys(aviatorBets[userId] || {}).length, 0);
        let crashPoint = totalBets > 100 ? parseFloat((Math.random() * 0.5 + 1.01).toFixed(2)) : Math.random() < 0.1 ? 1.00 : parseFloat((Math.random() * 10 + 1.1).toFixed(2));
        aviatorState.crashPoint = crashPoint;
        aviatorState.startTime = Date.now() + 5000; // 5 second countdown
        io.emit('aviatorState', { phase: 'waiting', startTime: aviatorState.startTime, history: aviatorState.history });
        setTimeout(() => {
            aviatorState.phase = 'playing';
            aviatorState.startTime = Date.now();
        }, 5000);
    }
}, 100);
// Initialize the first round
setTimeout(() => { aviatorState.phase = 'waiting_for_new_round'; }, 1000);


// 3. GALAXY SPIN ENGINE (No changes, remains stable)
// ... (All your existing, working Galaxy Spin code: states, loops, payouts, etc.) ...


// --- SOCKET.IO & SERVER STARTUP (No changes, remains stable) ---
io.on('connection', (socket) => { /* ... */ });
async function startServer() { /* ... */ }
startServer();
