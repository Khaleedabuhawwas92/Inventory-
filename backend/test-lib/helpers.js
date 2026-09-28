// Shared test bootstrap. Runs against a dedicated test database
// (inventory_system_test), never the real one — set before any other backend
// module is required, so config/env.js picks it up on first read.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test';

const http = require('http');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const app = require('../app');

let server;
let baseUrl;

async function startServer() {
  await connectDB();
  await mongoose.connection.db.dropDatabase();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;
  return baseUrl;
}

async function stopServer() {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
  await new Promise((resolve) => server.close(resolve));
}

async function api(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

module.exports = { startServer, stopServer, api };
