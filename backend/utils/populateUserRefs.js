const tenantContext = require('./tenantContext');

// User.role/User.warehouse point at tenant-scoped collections (Role,
// Warehouse), so populating them has to run inside that user's own tenant
// context — but we don't know which organization we're in until *after* the
// user has been loaded. Fetch the user first (unscoped, by _id/username/
// email), then populate refs inside a context derived from the user's own
// organizationId.
async function populateUserRefs(user) {
  if (!user) return user;
  // The callback must be `async` (not a plain arrow returning the un-awaited
  // populate() promise) — otherwise the actual query only executes at the
  // `await` outside this function, by which point the tenant context has
  // already been torn down. See utils/tenantPlugin.js / tenantContext.js.
  return tenantContext.run(user.organizationId, async () => user.populate(['role', 'warehouse']));
}

module.exports = populateUserRefs;
