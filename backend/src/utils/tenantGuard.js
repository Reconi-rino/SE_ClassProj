class TenantGuardError extends Error {
  constructor(message, code = "TENANT_CONTEXT_MISSING", status = 400) {
    super(message);
    this.name = "TenantGuardError";
    this.code = code;
    this.status = status;
  }
}

function requireTenant(req) {
  const tenant = req && req.tenant;
  if (!tenant || !Number.isInteger(tenant.id)) {
    throw new TenantGuardError("Tenant context is required before data access.");
  }
  return tenant;
}

function withTenantWhere(where, tenantId) {
  const normalizedWhere = where && typeof where === "object" ? { ...where } : {};
  normalizedWhere.tenant_id = tenantId;
  return normalizedWhere;
}

function tenantCreatePayload(req, payload) {
  const tenant = requireTenant(req);
  const normalizedPayload = payload && typeof payload === "object" ? { ...payload } : {};
  delete normalizedPayload.tenant_id;
  return {
    ...normalizedPayload,
    tenant_id: tenant.id,
  };
}

function tenantBulkCreatePayloads(req, payloads) {
  if (!Array.isArray(payloads)) {
    return [];
  }
  return payloads.map((payload) => tenantCreatePayload(req, payload));
}

function tenantQueryOptions(req, options) {
  const tenant = requireTenant(req);
  const normalizedOptions = options && typeof options === "object" ? { ...options } : {};
  const where = withTenantWhere(normalizedOptions.where, tenant.id);

  return {
    ...normalizedOptions,
    where,
  };
}

function isTenantGuardError(error) {
  return error instanceof TenantGuardError;
}

module.exports = {
  TenantGuardError,
  isTenantGuardError,
  requireTenant,
  tenantCreatePayload,
  tenantBulkCreatePayloads,
  tenantQueryOptions,
  withTenantWhere,
};
