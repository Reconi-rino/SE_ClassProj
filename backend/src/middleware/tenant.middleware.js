const jwt = require("jsonwebtoken");
const { Tenant, TenantMembership } = require("../models");

function readBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function decodeJwtPayload(req) {
  const token = readBearerToken(req);
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

function extractTenantHintsFromJwt(req) {
  const payload = decodeJwtPayload(req);
  if (!payload) return null;
  const tenantObj = payload.tenant && typeof payload.tenant === "object" ? payload.tenant : {};
  const tenantCode =
    payload.tenant_code || payload.tenantCode || tenantObj.code || tenantObj.tenant_code || null;
  const tenantId = payload.tenant_id || payload.tenantId || tenantObj.id || tenantObj.tenant_id || null;
  if (!tenantCode && !tenantId) return null;
  return {
    source: "jwt",
    code: typeof tenantCode === "string" ? tenantCode.trim() : null,
    id: Number.isInteger(tenantId) ? tenantId : Number.parseInt(tenantId, 10) || null,
  };
}

function buildTenantContext(tenant, source) {
  return { id: tenant.id, code: tenant.code, name: tenant.name, status: tenant.status, source };
}

async function resolveTenantContext(req, _res, next) {
  req.tenant = null;
  req.tenantResolution = { ok: false, reason: "missing" };

  const tenantCodeHeader = req.headers["x-tenant-code"];
  const normalizedHeaderCode = typeof tenantCodeHeader === "string" ? tenantCodeHeader.trim() : "";
  const headerHint = normalizedHeaderCode ? { source: "header", code: normalizedHeaderCode, id: null } : null;
  const jwtHint = headerHint ? null : extractTenantHintsFromJwt(req);
  const hint = headerHint || jwtHint;

  if (!hint) return next();

  try {
    let tenant = null;
    if (hint.code) {
      tenant = await Tenant.findOne({ where: { code: hint.code } });
    } else if (hint.id) {
      tenant = await Tenant.findByPk(hint.id);
    }

    if (!tenant) {
      req.tenantResolution = { ok: false, reason: "not_found", source: hint.source };
      return next();
    }
    if (tenant.status !== "active") {
      req.tenantResolution = { ok: false, reason: "inactive", source: hint.source };
      return next();
    }

    // Verify tenant membership if user is authenticated
    const jwtPayload = decodeJwtPayload(req);
    if (jwtPayload && jwtPayload.id) {
      const membership = await TenantMembership.findOne({
        where: { tenant_id: tenant.id, user_id: jwtPayload.id },
      });
      if (!membership) {
        // system_admin bypasses membership check (global role)
        const role = jwtPayload.role;
        const isGlobalAdmin = role === "system_admin" || role === "platform_admin";
        if (!isGlobalAdmin) {
          req.tenantResolution = { ok: false, reason: "not_member", source: hint.source };
          return next();
        }
      }
    }

    req.tenant = buildTenantContext(tenant, hint.source);
    req.tenantResolution = { ok: true, reason: "resolved", source: hint.source };
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireTenantContext(req, res, next) {
  const resolution = req.tenantResolution || { ok: false, reason: "missing" };
  if (resolution.ok && req.tenant) return next();

  if (resolution.reason === "missing") {
    return res.status(400).json({
      success: false, message: "Tenant context is required. Provide x-tenant-code header.",
      code: "TENANT_CONTEXT_MISSING",
    });
  }
  if (resolution.reason === "not_found") {
    return res.status(403).json({
      success: false, message: "Tenant does not exist.", code: "TENANT_NOT_FOUND",
    });
  }
  if (resolution.reason === "inactive") {
    return res.status(403).json({
      success: false, message: "Tenant is inactive.", code: "TENANT_INACTIVE",
    });
  }
  if (resolution.reason === "not_member") {
    return res.status(403).json({
      success: false, message: "You are not a member of this tenant.", code: "TENANT_NOT_MEMBER",
    });
  }
  return res.status(400).json({
    success: false, message: "Invalid tenant context.", code: "TENANT_CONTEXT_INVALID",
  });
}

module.exports = { resolveTenantContext, requireTenantContext };
