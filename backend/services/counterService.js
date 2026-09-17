const Counter = require('../models/Counter');

// Atomically returns the next sequence number for `key`, padded to `padLength`.
// Safe under concurrent requests: MongoDB's findOneAndUpdate with $inc + upsert
// is atomic, so two simultaneous callers can never receive the same number.
async function nextSequence(key, { padLength = 6 } = {}) {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return String(doc.seq).padStart(padLength, '0');
}

async function nextDocumentNumber(prefix, { yearScoped = true, padLength = 6 } = {}) {
  const year = new Date().getFullYear();
  const key = yearScoped ? `${prefix}-${year}` : prefix;
  const seq = await nextSequence(key, { padLength });
  return yearScoped ? `${prefix}-${year}-${seq}` : `${prefix}-${seq}`;
}

module.exports = { nextSequence, nextDocumentNumber };
