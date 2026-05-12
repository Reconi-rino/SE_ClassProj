const { TenantMembership } = require("../models");
const { isTenantGuardError, tenantCreatePayload, tenantQueryOptions } = require("../utils/tenantGuard");

function toTenantSafeError(res, error) {
  return res.status(error.status || 400).json({
    success: false,
    message: error.message || "Invalid tenant context.",
    code: error.code || "TENANT_CONTEXT_INVALID",
  });
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

async function listTenantMemberships(req, res, next) {
  try {
    const memberships = await TenantMembership.findAll(
      tenantQueryOptions(req, {
        order: [["id", "DESC"]],
      })
    );

    return res.status(200).json({
      success: true,
      data: memberships,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function createTenantMembership(req, res, next) {
  try {
    const userId = parsePositiveInt(req.body.user_id);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "user_id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const membership = await TenantMembership.create(
      tenantCreatePayload(req, {
        user_id: userId,
        role: req.body.role || "member",
      })
    );

    return res.status(201).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function updateTenantMembershipRole(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const role = req.body.role;
    if (!["tenant_admin", "member"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "role must be tenant_admin or member.",
        code: "VALIDATION_ERROR",
      });
    }

    const [updatedCount] = await TenantMembership.update(
      { role },
      tenantQueryOptions(req, {
        where: { id },
      })
    );

    if (updatedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Tenant membership not found.",
      });
    }

    const membership = await TenantMembership.findOne(
      tenantQueryOptions(req, {
        where: { id },
      })
    );

    return res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function deleteTenantMembership(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const deletedCount = await TenantMembership.destroy(
      tenantQueryOptions(req, {
        where: { id },
      })
    );

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Tenant membership not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tenant membership deleted.",
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

module.exports = {
  listTenantMemberships,
  createTenantMembership,
  updateTenantMembershipRole,
  deleteTenantMembership,
};
