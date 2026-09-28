const express = require('express');
const { authenticate } = require('../middleware/auth');
const requirePlatformAdmin = require('../middleware/requirePlatformAdmin');

const dashboardController = require('../controllers/platform/dashboard.controller');
const organizationsController = require('../controllers/platform/organizations.controller');
const organizationDetailController = require('../controllers/platform/organizationDetail.controller');
const usersController = require('../controllers/platform/users.controller');
const auditController = require('../controllers/platform/audit.controller');
const securityController = require('../controllers/platform/security.controller');
const invitationsController = require('../controllers/platform/invitations.controller');

const router = express.Router();

// Every route below is gated by BOTH authenticate (a real, valid session)
// AND requirePlatformAdmin (req.user.isPlatformAdmin === true specifically —
// never role.name). This is intentionally the one part of the API that
// reads/writes across every organization at once; each controller opts into
// that explicitly via tenantContext.runWithoutTenant (see
// utils/tenantContext.js) rather than relying on any ambient scoping, and
// tenant isolation for every *other* route is completely unaffected.
router.use(authenticate);
router.use(requirePlatformAdmin);

router.get('/dashboard', dashboardController.dashboard);

router.get('/organizations', organizationsController.list);
router.get('/organizations/:id', organizationsController.getById);
router.patch('/organizations/:id', organizationsController.updateInfo);
router.patch('/organizations/:id/status', organizationsController.updateStatus);
router.patch('/organizations/:id/owner', organizationsController.updateOwner);

router.get('/organizations/:id/subscription', organizationDetailController.getSubscription);
router.patch('/organizations/:id/subscription', organizationDetailController.updateSubscription);

router.get('/organizations/:id/limits', organizationDetailController.getLimits);
router.patch('/organizations/:id/limits', organizationDetailController.updateLimits);

router.get('/organizations/:id/features', organizationDetailController.getFeatures);
router.patch('/organizations/:id/features', organizationDetailController.updateFeatures);

router.post('/organizations/:id/revoke-sessions', organizationDetailController.revokeOrganizationSessions);

router.patch('/organizations/:id/users/:userId/role', organizationDetailController.setUserRole);
router.patch('/organizations/:id/users/:userId/warehouse', organizationDetailController.setUserWarehouse);
router.post('/organizations/:id/users/:userId/revoke-sessions', organizationDetailController.revokeUserSessions);

router.get('/organizations/:id/notes', organizationDetailController.listNotes);
router.post('/organizations/:id/notes', organizationDetailController.createNote);

router.get('/organizations/:id/stats', organizationDetailController.stats);
router.get('/organizations/:id/roles', organizationDetailController.roles);

router.get('/organizations/:id/warehouses', organizationDetailController.warehouses);
router.get('/organizations/:id/warehouses/:warehouseId', organizationDetailController.warehouseDetail);
router.patch('/organizations/:id/warehouses/:warehouseId/status', organizationDetailController.setWarehouseStatus);

router.get('/organizations/:id/products', organizationDetailController.products);
router.get('/organizations/:id/products/:productId', organizationDetailController.productDetail);

router.get('/organizations/:id/movements', organizationDetailController.movements);

router.post('/organizations/:id/invitations/:invitationId/revoke', organizationDetailController.revokeInvitation);

// The next three reuse the *exact same* controllers/logic as the top-level
// /platform/users, /platform/audit and /platform/invitations endpoints below
// — only the organizationId is forced from the URL param instead of a query
// string, so a caller can never pass a different one to see another
// organization's data through this "scoped" URL (spec §11: never trust an
// untrusted value to decide authorization — the trusted source here is the
// URL param itself, which is what requirePlatformAdmin + this route already
// gate access to).
function scopeToUrlOrganization(req, res, next) {
  req.query.organizationId = req.params.id;
  next();
}
router.get('/organizations/:id/users', scopeToUrlOrganization, usersController.list);
router.get('/organizations/:id/audit', scopeToUrlOrganization, auditController.list);
router.get('/organizations/:id/invitations', scopeToUrlOrganization, invitationsController.list);

router.get('/users', usersController.list);
router.get('/users/:id', usersController.getById);
router.patch('/users/:id/status', usersController.updateStatus);
router.post('/users/:id/reset-password', usersController.resetPassword);

router.get('/audit', auditController.list);
router.get('/security', securityController.security);
router.get('/invitations', invitationsController.list);

module.exports = router;
