const jwt = require("jsonwebtoken");
const { Tenant } = require("../models");

function readBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }
  return token;
}

function extractTenantHintsFromJwt(req) {
  const token = readBearerToken(req);
  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tenantObj = payload.tenant && typeof payload.tenant === "object" ? payload.tenant : {};
    const tenantCode =
      payload.tenant_code || payload.tenantCode || tenantObj.code || tenantObj.tenant_code || null;
    const tenantId = payload.tenant_id || payload.tenantId || tenantObj.id || tenantObj.tenant_id || null;

    if (!tenantCode && !tenantId) {
      return null;
    }

    return {
      source: "jwt",
      code: typeof tenantCode === "string" ? tenantCode.trim() : null,
      id: Number.isInteger(tenantId) ? tenantId : Number.parseInt(tenantId, 10) || null,
    };
  } catch (_error) {
    return null;
  }
}

function buildTenantContext(tenant, source) {
  return {
    id: tenant.id,
    code: tenant.code,
    name: tenant.name,
    status: tenant.status,
    source,
  };
}

async function resolveTenantContext(req, _res, next) {
  req.tenant = null;
  req.tenantResolution = { ok: false, reason: "missing" };

  const tenantCodeHeader = req.headers["x-tenant-code"];
  const normalizedHeaderCode = typeof tenantCodeHeader === "string" ? tenantCodeHeader.trim() : "";
  const headerHint = normalizedHeaderCode ? { source: "header", code: normalizedHeaderCode, id: null } : null;
  const jwtHint = headerHint ? null : extractTenantHintsFromJwt(req);
  const hint = headerHint || jwtHint;

  if (!hint) {
    return next();
  }

  try {
    let tenant = null;
    if (hint.code) {
      tenant = await Tenant.findOne({ where: { code: hint.code } });
    } else if (hint.id) {
      tenant = await Tenant.findByPk(hint.id);
    }

    if (!tenant) {
      req.tenantResolution = {
        ok: false,
        reason: "not_found",
        source: hint.source,
      };
      return next();
    }

    if (tenant.status !== "active") {
      req.tenantResolution = {
        ok: false,
        reason: "inactive",
        source: hint.source,
      };
      return next();
    }

    req.tenant = buildTenantContext(tenant, hint.source);
    req.tenantResolution = {
      ok: true,
      reason: "resolved",
      source: hint.source,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireTenantContext(req, res, next) {
  const resolution = req.tenantResolution || { ok: false, reason: "missing" };
  if (resolution.ok && req.tenant) {
    return next();
  }

  if (resolution.reason === "missing") {
    return res.status(400).json({
      success: false,
      message: "Tenant context is required. Provide x-tenant-code header.",
      code: "TENANT_CONTEXT_MISSING",
    });
  }

  if (resolution.reason === "not_found") {
    return res.status(403).json({
      success: false,
      message: "Tenant does not exist.",
      code: "TENANT_NOT_FOUND",
    });
  }

  if (resolution.reason === "inactive") {
    return res.status(403).json({
      success: false,
      message: "Tenant is inactive.",
      code: "TENANT_INACTIVE",
    });
  }

  return res.status(400).json({
    success: false,
    message: "Invalid tenant context.",
    code: "TENANT_CONTEXT_INVALID",
  });
}

module.exports = {
  resolveTenantContext,
  requireTenantContext,
};
