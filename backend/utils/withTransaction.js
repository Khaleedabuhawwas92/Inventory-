const mongoose = require('mongoose');

// Runs `fn(session)` inside a MongoDB transaction. Standalone MongoDB instances
// (common in local development) do not support transactions, only replica sets /
// mongos do (MongoDB Atlas is always a replica set). In that case we fall back to
// running `fn(null)` without a session so local development still works; this is
// logged clearly since it means the operation is no longer atomic.
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    const notSupported =
      err.code === 20 || /Transaction numbers are only allowed|IllegalOperation/i.test(err.message || '');
    if (notSupported) {
      console.warn(
        '[withTransaction] MongoDB does not support transactions (standalone instance) — running without atomicity. Use a replica set (or MongoDB Atlas) in production.'
      );
      return fn(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = withTransaction;
