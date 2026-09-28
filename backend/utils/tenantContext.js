const { AsyncLocalStorage } = require('async_hooks');

// Server-side-only source of truth for "which organization is this request
// operating on". Never derived from anything the client sends (body/query/
// params) — always from the authenticated user's own organizationId, or from
// an organization the server itself just created (registration/onboarding).
// Every tenant-scoped model query is auto-filtered against this value by
// utils/tenantPlugin.js, so a controller cannot leak data across
// organizations even if it forgets to filter explicitly.
const als = new AsyncLocalStorage();

// `fn` is invoked as `async () => fn()`, not called directly — a Mongoose
// Query is lazy and only actually executes once `.then()`/`.exec()` is
// called, so if `fn` were a plain (non-async) function that just *returns*
// a Query without awaiting it, that execution would happen at the `await`
// on the OUTER caller's side, by which point `als.run()` has already
// returned and torn down this context — silently running with no tenant
// context at all. Wrapping in `async () => fn()` here means the returned
// value's resolution is always scheduled from inside the active store,
// regardless of whether the caller's own `fn` remembered to `await` inside
// itself. See the (fixed) bug this guards against in
// controllers/onboarding.controller.js's git history.
function run(organizationId, fn) {
  return als.run({ organizationId: organizationId || null, bypass: false }, async () => fn());
}

// Only for trusted, non-request code paths (migration scripts, dev seed,
// the cross-organization backup scheduler) that must read/write across
// every organization or set organizationId explicitly themselves. Never
// call this from ordinary request-handling code.
function runWithoutTenant(fn) {
  return als.run({ organizationId: null, bypass: true }, async () => fn());
}

function getOrganizationId() {
  return als.getStore()?.organizationId || null;
}

function isBypassed() {
  return !!als.getStore()?.bypass;
}

module.exports = { run, runWithoutTenant, getOrganizationId, isBypassed };
