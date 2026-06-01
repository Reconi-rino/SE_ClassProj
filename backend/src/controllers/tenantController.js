const { Tenant } = require("../models");
const { ApiError } = require("../utils/common");
const { parsePositiveInt } = require("../utils/common");

async function listActiveTenants(req, res, next) {
  try {
    const tenants = await Tenant.findAll({
      where: { status: "active" },
      attributes: ["id", "code", "name", "status", "created_at"],
      order: [["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: tenants });
  } catch (error) {
    return next(error);
  }
}

async function createTenant(req, res, next) {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      throw new ApiError(400, "VALIDATION_ERROR", "name and code are required.");
    }

    const existing = await Tenant.findOne({ where: { code } });
    if (existing) {
      throw new ApiError(409, "CONFLICT", "Tenant code already exists.");
    }

    const tenant = await Tenant.create({ name: name.trim(), code: code.trim(), status: "active" });
    return res.status(201).json({ success: true, data: tenant });
  } catch (error) {
    if (error.name === "ApiError") {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    return next(error);
  }
}

async function updateTenant(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new ApiError(400, "VALIDATION_ERROR", "Invalid tenant id.");

    const tenant = await Tenant.findByPk(id);
    if (!tenant) throw new ApiError(404, "NOT_FOUND", "Tenant not found.");

    if (req.body.name !== undefined) tenant.name = req.body.name.trim();
    if (req.body.status !== undefined && ["active", "inactive", "archived"].includes(req.body.status)) {
      tenant.status = req.body.status;
    }

    await tenant.save();
    return res.status(200).json({ success: true, data: tenant });
  } catch (error) {
    if (error.name === "ApiError") {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    return next(error);
  }
}

async function deleteTenant(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new ApiError(400, "VALIDATION_ERROR", "Invalid tenant id.");

    const tenant = await Tenant.findByPk(id);
    if (!tenant) throw new ApiError(404, "NOT_FOUND", "Tenant not found.");

    // 不允许删除 default 租户
    if (tenant.code === "default") {
      throw new ApiError(400, "VALIDATION_ERROR", "Cannot delete the default tenant.");
    }

    await tenant.destroy();
    return res.status(200).json({ success: true, message: "Tenant deleted." });
  } catch (error) {
    if (error.name === "ApiError") {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    return next(error);
  }
}

module.exports = {
  listActiveTenants,
  createTenant,
  updateTenant,
  deleteTenant,
};
