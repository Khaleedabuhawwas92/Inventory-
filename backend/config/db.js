const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

async function connectDB() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('[MongoDB] Connected');
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('[MongoDB] Disconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

function getConnectionStatus() {
  return isConnected;
}

module.exports = { connectDB, getConnectionStatus };
