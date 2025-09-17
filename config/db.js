const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in environment');
}

let cached = global.__mongoCache || (global.__mongoCache = { conn: null, promise: null });

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!MONGODB_URI) {
    const err = new Error('MONGODB_URI not configured');
    console.error(err);
    throw err;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongooseInstance) => {
      return mongooseInstance;
    }).catch((err) => {
      // Clear promise so next invocation can retry
      cached.promise = null;
      console.error('MongoDB initial connection error:', err && err.message ? err.message : err);
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
