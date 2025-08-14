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
// IMPORTANT: You MUST replace this with your own free MongoDB connection string!
const dbURI = "YOUR_MONGODB_CONNECTION_STRING_HERE"; 
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Successfully connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// --- API Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game'));
// We will not build the admin routes yet to keep it simple

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
