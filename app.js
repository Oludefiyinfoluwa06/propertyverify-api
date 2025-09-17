require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const { errorHandler, notFound } = require('./utils/errorHandler');
const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const verificationRoutes = require('./routes/verifications');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'tmp/uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/admin', adminRoutes);

// Track DB connection status for health checks
let dbConnected = false;
const PORT = process.env.PORT;

// Attempt to connect at module init; in serverless environments this will reuse cached connection
connectDB().then(() => {
  dbConnected = true;
  console.log('MongoDB connection ready');
  app.listen(PORT, () => {
    console.log(`Server listening on port: http://localhost:${PORT}`);
  })
}).catch((err) => {
  dbConnected = false;
  console.error('MongoDB connection failed at startup:', err && err.message ? err.message : err);
  // Do not exit the process in serverless environments; operations will error if DB is required
});

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'PropertyVerify API is running', dbConnected });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
