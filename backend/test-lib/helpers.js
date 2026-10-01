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

// `cookie` sends a raw Cookie header (e.g. the refresh-token cookie captured
// from a previous response's `setCookie`); Node's fetch has no automatic
// cookie jar, unlike a browser, so refresh-token tests thread it through
// manually. The result's `setCookie` is the raw Set-Cookie header value (if
// any), for the caller to pass into the next request.
async function api(method, path, { body, token, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json, setCookie: res.headers.get('set-cookie') };
}

// Pulls just the "name=value" pair out of a raw Set-Cookie header (dropping
// Path/HttpOnly/SameSite/... attributes), ready to pass back as `cookie` on
// the next api() call.
function cookieValue(setCookieHeader) {
  if (!setCookieHeader) return null;
  return setCookieHeader.split(';')[0];
}

module.exports = { startServer, stopServer, api, cookieValue };
