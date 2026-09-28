const mongoose = require('mongoose');
const tenantContext = require('./tenantContext');

// Mongoose plugin enforcing multi-tenant data isolation at the database layer
// itself, not per-controller — so isolation holds even if a controller forgets
// to filter by organization. Two things happen:
//
//   1. On document creation, `organizationId` is force-set from the server-side
//      tenant context (never trusted from client input, even if present in the
//      request body — this overwrites it unconditionally).
//   2. On every read/update/delete query and every aggregation, `organizationId`
//      is auto-injected into the filter from the same context, so a query for
//      another organization's document (e.g. by guessing an _id) simply matches
//      nothing instead of leaking data.
//
// Models whose access patterns must legitimately search *before* an
// organization is known (User, Role, Invitation-by-code) do not use this
// plugin — those are scoped manually where needed.
module.exports = function tenantPlugin(schema) {
  // Not indexed here with `index: true` — every model using this plugin
  // already defines its own index(es) with organizationId as the leading
  // key (either a dedicated `{organizationId: 1}` index, or a compound one
  // like `{organizationId: 1, sku: 1}`, whose leftmost prefix serves
  // organizationId-only queries too), so a second, separate single-field
  // index here would just be a duplicate index warning.
  schema.add({
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
  });

  schema.pre('validate', function tenantAssign(next) {
    if (this.isNew) {
      const ctxOrgId = tenantContext.getOrganizationId();
      if (ctxOrgId) {
        this.organizationId = ctxOrgId;
      } else if (!this.organizationId && !tenantContext.isBypassed()) {
        return next(new Error('لا يمكن إنشاء سجل بدون سياق منظمة (organization context) صالح'));
      }
    }
    next();
  });

  const scopedQueryOps = [
    'find', 'findOne',
    'findOneAndUpdate', 'findOneAndDelete', 'findOneAndRemove',
    'count', 'countDocuments',
    'updateOne', 'updateMany',
    'deleteOne', 'deleteMany',
    'distinct',
  ];

  scopedQueryOps.forEach((op) => {
    schema.pre(op, function tenantScopeQuery(next) {
      if (tenantContext.isBypassed()) return next();

      const existing = this.getQuery();
      if (existing.organizationId) return next(); // explicitly scoped already

      const orgId = tenantContext.getOrganizationId();
      if (!orgId) {
        return next(new Error('لا يمكن تنفيذ الاستعلام بدون سياق منظمة (organization context) صالح'));
      }
      this.where({ organizationId: orgId });
      next();
    });

    // Also strip any client-supplied organizationId from update payloads so a
    // PATCH body can never move a document into another organization.
    if (op.startsWith('update') || op.startsWith('findOneAnd')) {
      schema.pre(op, function stripOrgFromUpdate(next) {
        const update = this.getUpdate?.();
        if (update) {
          delete update.organizationId;
          if (update.$set) delete update.$set.organizationId;
        }
        next();
      });
    }
  });

  schema.pre('aggregate', function tenantScopeAggregate(next) {
    if (tenantContext.isBypassed()) return next();

    const orgId = tenantContext.getOrganizationId();
    if (!orgId) {
      return next(new Error('لا يمكن تنفيذ التجميع بدون سياق منظمة (organization context) صالح'));
    }
    this.pipeline().unshift({ $match: { organizationId: new mongoose.Types.ObjectId(orgId) } });
    next();
  });
};
