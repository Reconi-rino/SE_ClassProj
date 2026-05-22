const financialService = require("../services/financial.service");
const { handleServiceError, handleRequestValidation } = require("../utils/errorResponse");

async function listFinancialRecords(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const tenantId = req.tenant ? req.tenant.id : null;
    const { club_id, type, category, year, month, limit } = req.query;
    const records = await financialService.listFinancialRecords({
      tenantId,
      filters: {
        clubId: club_id,
        type,
        category,
        year: year ? Number.parseInt(year, 10) : undefined,
        month: month ? Number.parseInt(month, 10) : undefined,
        limit,
      },
    });
    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getFinancialRecord(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const tenantId = req.tenant ? req.tenant.id : null;
    const record = await financialService.getFinancialRecord({
      tenantId,
      id: req.params.id,
    });
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createFinancialRecord(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const record = await financialService.createFinancialRecord({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      payload: req.body,
    });
    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateFinancialRecord(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const record = await financialService.updateFinancialRecord({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      id: req.params.id,
      body: req.body,
    });
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function deleteFinancialRecord(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    await financialService.deleteFinancialRecord({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      id: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Financial record deleted." });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getFinancialMonthlySummary(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const tenantId = req.tenant ? req.tenant.id : null;
    const result = await financialService.getFinancialMonthlySummary({
      tenantId,
      clubId: req.query.club_id ? Number.parseInt(req.query.club_id, 10) : null,
      year: Number.parseInt(req.query.year, 10),
      month: Number.parseInt(req.query.month, 10),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getFinancialYearlySummary(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const tenantId = req.tenant ? req.tenant.id : null;
    const result = await financialService.getFinancialYearlySummary({
      tenantId,
      clubId: req.query.club_id ? Number.parseInt(req.query.club_id, 10) : null,
      year: Number.parseInt(req.query.year, 10),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getFinancialAggregates(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const tenantId = req.tenant ? req.tenant.id : null;
    const result = await financialService.getFinancialAggregates({
      tenantId,
      clubId: req.query.club_id ? Number.parseInt(req.query.club_id, 10) : null,
      year: req.query.year ? Number.parseInt(req.query.year, 10) : null,
      month: req.query.month ? Number.parseInt(req.query.month, 10) : null,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

module.exports = {
  listFinancialRecords,
  getFinancialRecord,
  createFinancialRecord,
  updateFinancialRecord,
  deleteFinancialRecord,
  getFinancialMonthlySummary,
  getFinancialYearlySummary,
  getFinancialAggregates,
};
