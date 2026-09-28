import api from './api';

// Every call here hits /api/platform/*, gated server-side by
// requirePlatformAdmin (req.user.isPlatformAdmin === true, never role name).
export default {
  dashboard() {
    return api.get('/platform/dashboard');
  },
  organizations(params = {}) {
    return api.get('/platform/organizations', { params });
  },
  organization(id) {
    return api.get(`/platform/organizations/${id}`);
  },
  setOrganizationStatus(id, status, reason) {
    return api.patch(`/platform/organizations/${id}/status`, { status, reason });
  },
  updateOrganizationInfo(id, payload) {
    return api.patch(`/platform/organizations/${id}`, payload);
  },
  transferOwnership(id, newOwnerId) {
    return api.patch(`/platform/organizations/${id}/owner`, { newOwnerId });
  },
  getSubscription(id) {
    return api.get(`/platform/organizations/${id}/subscription`);
  },
  updateSubscription(id, payload) {
    return api.patch(`/platform/organizations/${id}/subscription`, payload);
  },
  getLimits(id) {
    return api.get(`/platform/organizations/${id}/limits`);
  },
  updateLimits(id, payload) {
    return api.patch(`/platform/organizations/${id}/limits`, payload);
  },
  getFeatures(id) {
    return api.get(`/platform/organizations/${id}/features`);
  },
  updateFeatures(id, payload) {
    return api.patch(`/platform/organizations/${id}/features`, payload);
  },
  revokeOrganizationSessions(id, reason) {
    return api.post(`/platform/organizations/${id}/revoke-sessions`, { reason });
  },
  setOrgUserRole(id, userId, role) {
    return api.patch(`/platform/organizations/${id}/users/${userId}/role`, { role });
  },
  setOrgUserWarehouse(id, userId, warehouse) {
    return api.patch(`/platform/organizations/${id}/users/${userId}/warehouse`, { warehouse });
  },
  revokeOrgUserSessions(id, userId) {
    return api.post(`/platform/organizations/${id}/users/${userId}/revoke-sessions`);
  },
  organizationNotes(id, params = {}) {
    return api.get(`/platform/organizations/${id}/notes`, { params });
  },
  addOrganizationNote(id, payload) {
    return api.post(`/platform/organizations/${id}/notes`, payload);
  },
  organizationStats(id) {
    return api.get(`/platform/organizations/${id}/stats`);
  },
  organizationRoles(id) {
    return api.get(`/platform/organizations/${id}/roles`);
  },
  organizationWarehouses(id, params = {}) {
    return api.get(`/platform/organizations/${id}/warehouses`, { params });
  },
  organizationWarehouse(id, warehouseId, params = {}) {
    return api.get(`/platform/organizations/${id}/warehouses/${warehouseId}`, { params });
  },
  setWarehouseStatus(id, warehouseId, status) {
    return api.patch(`/platform/organizations/${id}/warehouses/${warehouseId}/status`, { status });
  },
  organizationUsers(id, params = {}) {
    return api.get(`/platform/organizations/${id}/users`, { params });
  },
  organizationProducts(id, params = {}) {
    return api.get(`/platform/organizations/${id}/products`, { params });
  },
  organizationProduct(id, productId) {
    return api.get(`/platform/organizations/${id}/products/${productId}`);
  },
  organizationMovements(id, params = {}) {
    return api.get(`/platform/organizations/${id}/movements`, { params });
  },
  organizationInvitations(id, params = {}) {
    return api.get(`/platform/organizations/${id}/invitations`, { params });
  },
  revokeOrganizationInvitation(id, invitationId) {
    return api.post(`/platform/organizations/${id}/invitations/${invitationId}/revoke`);
  },
  organizationAudit(id, params = {}) {
    return api.get(`/platform/organizations/${id}/audit`, { params });
  },
  users(params = {}) {
    return api.get('/platform/users', { params });
  },
  user(id) {
    return api.get(`/platform/users/${id}`);
  },
  setUserStatus(id, status) {
    return api.patch(`/platform/users/${id}/status`, { status });
  },
  resetUserPassword(id) {
    return api.post(`/platform/users/${id}/reset-password`);
  },
  audit(params = {}) {
    return api.get('/platform/audit', { params });
  },
  security() {
    return api.get('/platform/security');
  },
  invitations(params = {}) {
    return api.get('/platform/invitations', { params });
  },
};
