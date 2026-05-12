const { Tenant } = require("../models");

async function listActiveTenants(req, res, next) {
  try {
    const tenants = await Tenant.findAll({
      where: {
        status: "active",
      },
      attributes: ["id", "code", "name"],
      order: [["id", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: tenants,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listActiveTenants,
};
