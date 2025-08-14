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
const dbURI = "mongodb+srv://myuser:mypassword123@myapp.xrwnb4n.mongodb.net/?retryWrites=true&w=majority&appName=myapp";

// --- API Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game'));
// We will not build the admin routes yet to keep it simple

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
