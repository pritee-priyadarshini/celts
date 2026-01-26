require('dotenv').config();
require('./services/gradingWorker');
const express = require('express');
const path = require('path');
const cors = require('cors');
const { GoogleGenAI } = require("@google/genai");

const connectDB = require('./config/mongoDB');
const logger = require('./config/logger');
const apiRoutes = require('./routes/index');
const examTimerService = require('./services/examTimerService'); 
const { closeQueue } = require('./services/queue'); 

const ai= new GoogleGenAI({});

connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



const allowedOrigins = [
  "https://celts.cutm.ac.in",
  "http://localhost:3000"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS Not Allowed"));
    }
  },
  credentials: true
}));


console.log(`Starting CELTS Backend on port ${PORT}...`);

// Log ALL incoming requests for debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  if (req.path.includes('/submit')) {
    console.log(`[REQUEST] Headers:`, req.headers);
    console.log(`[REQUEST] Body type:`, typeof req.body);
    console.log(`[REQUEST] Is FormData:`, req.headers['content-type']);
  }
  next();
});

app.use('/api', apiRoutes);

const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API Endpoint Not Found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

const server = app.listen(PORT, () =>
  console.log( `Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`)
);

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('HTTP server closed.');
    
    try {
      await closeQueue();
    } catch (err) {
      console.error('Error closing queue:', err.message);
    }
    
    if (examTimerService && typeof examTimerService.shutdown === 'function') {
      examTimerService.shutdown();
    }
    
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000); 
}
