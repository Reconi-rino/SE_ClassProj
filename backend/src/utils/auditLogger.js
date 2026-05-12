const fs = require("fs");
const path = require("path");

function resolveAuditLogPath() {
  if (process.env.AUDIT_LOG_FILE) {
    return path.resolve(process.env.AUDIT_LOG_FILE);
  }
  return path.resolve(process.cwd(), "logs", "audit.log");
}

function normalizeActor(req, actor) {
  if (actor) {
    return actor;
  }
  if (!req || !req.user) {
    return null;
  }
  return {
    id: req.user.id || null,
    role: req.user.role || null,
    email: req.user.email || null,
  };
}

function normalizeTenant(req, tenant) {
  if (tenant) {
    return tenant;
  }
  if (!req || !req.tenant) {
    return null;
  }
  return {
    id: req.tenant.id || null,
    code: req.tenant.code || null,
  };
}

function logAuditEvent({ req, action, outcome, actor, tenant, target, metadata }) {
  const entry = {
    type: "audit",
    timestamp: new Date().toISOString(),
    action,
    outcome: outcome || "success",
    actor: normalizeActor(req, actor),
    tenant: normalizeTenant(req, tenant),
    target: target || null,
    metadata: metadata || {},
    request: req
      ? {
          method: req.method,
          path: req.originalUrl || req.path || null,
          request_id: req.headers["x-request-id"] || null,
        }
      : null,
  };

  const logLine = JSON.stringify(entry);
  const filePath = resolveAuditLogPath();
  const directory = path.dirname(filePath);

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.appendFileSync(filePath, `${logLine}\n`, { encoding: "utf8" });
  } catch (error) {
    console.error("Failed to persist audit log:", error.message);
  }
}

module.exports = {
  logAuditEvent,
  resolveAuditLogPath,
};
