// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');


// Load DB connector and routes
const connectDB = require('./config/mongoDB');
const logger = require('./config/logger');
const apiRoutes = require('./routes/index'); // make sure this exists

// Connect to DB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// Allow requests from your frontend (Next.js default port 3000)
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));


// Basic rate limiting for auth endpoints (prevent brute force)
const rateLimit = require('express-rate-limit');
app.use('/api/auth', rateLimit({ windowMs: 60 * 1000, max: 20 }));

// Log initial message
console.log(`Starting CELTS Backend on port ${PORT}...`);

// --- API Routes ---
app.use('/api', apiRoutes);

// --- Static Frontend Serving ---
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

// Catch-all for SPA routing (non-API routes)
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API Endpoint Not Found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

//Global error handling
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

// Start the server
app.listen(PORT, () =>
  console.log( `Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`)
);
