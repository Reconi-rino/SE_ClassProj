const { Op, fn, col, literal } = require("sequelize");
const { FinancialRecord, Club, ClubMember, User } = require("../models");
const { ApiError, parsePositiveInt } = require("../utils/common");
const { tenantCreatePayload, tenantQueryOptions } = require("../utils/tenantGuard");
const { logAuditEvent } = require("../utils/auditLogger");

const RECORD_TYPES = new Set(["income", "expense"]);
const PUBLIC_READ_GLOBAL_ROLES = new Set(["system_admin", "platform_admin"]);
const WRITE_ALLOWED_GLOBAL_ROLES = new Set(["system_admin", "platform_admin", "club_admin"]);
const CLUB_WRITER_ROLES = new Set(["founder", "admin"]);

function parseMoney(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed.toFixed(2);
}

function parseTransactionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function normalizeCategory(value) {
  if (typeof value !== "string") return null;
  const category = value.trim();
  if (!category || category.length > 100) return null;
  return category;
}

function parseMonth(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) return null;
  return parsed;
}

function parseYear(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1970 || parsed > 9999) return null;
  return parsed;
}

function isGlobalPrivileged(userRole) {
  return userRole === "system_admin" || userRole === "platform_admin";
}

async function ensureClub(tenantId, clubId) {
  const club = await Club.findOne({ where: { id: clubId, tenant_id: tenantId } });
  if (!club) {
    throw new ApiError(404, "CLUB_NOT_FOUND", "Club not found in tenant scope.");
  }
  return club;
}

async function ensureRecord(tenantId, id) {
  const record = await FinancialRecord.findOne({
    where: { id, tenant_id: tenantId },
  });
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Financial record not found.");
  }
  return record;
}

async function resolveClubRole(tenantId, userId, clubId) {
  if (!userId) return null;
  const membership = await ClubMember.findOne({
    where: { tenant_id: tenantId, club_id: clubId, user_id: userId },
  });
  return membership ? membership.role : null;
}

async function canWriteFinancial(tenantId, userId, clubId) {
  if (!userId) return false;
  const user = await User.findByPk(userId);
  const actorGlobalRole = user?.role || null;
  if (WRITE_ALLOWED_GLOBAL_ROLES.has(actorGlobalRole)) return true;
  const clubRole = await resolveClubRole(tenantId, userId, clubId);
  return CLUB_WRITER_ROLES.has(clubRole);
}

function buildValidationPayload(body) {
  const errors = [];
  const clubId = parsePositiveInt(body.club_id);
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const amount = parseMoney(body.amount);
  const category = normalizeCategory(body.category);
  const transactionDate = parseTransactionDate(body.transaction_date);
  const description = typeof body.description === "string" ? body.description.trim() : null;

  if (!clubId) errors.push("club_id must be a positive integer.");
  if (!RECORD_TYPES.has(type)) errors.push("type must be income or expense.");
  if (!amount) errors.push("amount must be a positive number.");
  if (!category) errors.push("category is required and must be <= 100 chars.");
  if (!transactionDate) errors.push("transaction_date must be a valid date.");

  return {
    errors,
    payload: { club_id: clubId, type, amount, category, description, transaction_date: transactionDate },
  };
}

async function listFinancialRecords({ tenantId, filters = {} }) {
  const { clubId, type, category, year, month, limit = 50 } = filters;
  const resolvedLimit = Math.min(parsePositiveInt(limit) || 50, 200);

  const where = {};
  if (clubId) where.club_id = parsePositiveInt(clubId);
  if (type && RECORD_TYPES.has(type)) where.type = type;
  if (category) where.category = normalizeCategory(category);

  if (year && month) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    where.transaction_date = { [Op.gte]: start, [Op.lt]: end };
  } else if (year) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    where.transaction_date = { [Op.gte]: start, [Op.lt]: end };
  }

  return FinancialRecord.findAll({
    where: { ...where, tenant_id: tenantId },
    order: [["transaction_date", "DESC"], ["id", "DESC"]],
    limit: resolvedLimit,
  });
}

async function getFinancialRecord({ tenantId, id }) {
  const recordId = parsePositiveInt(id);
  if (!recordId) {
    throw new ApiError(400, "VALIDATION_ERROR", "id must be a positive integer.");
  }
  return ensureRecord(tenantId, recordId);
}

async function createFinancialRecord({ tenantId, actorUserId, payload }) {
  const actor = await User.findByPk(actorUserId);
  const { errors, payload: validated } = buildValidationPayload(payload);
  if (errors.length > 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Validation failed", errors);
  }

  await ensureClub(tenantId, validated.club_id);

  const allowed = await canWriteFinancial(tenantId, actorUserId, validated.club_id);
  if (!allowed) {
    throw new ApiError(403, "AUTHORIZATION_DENIED", "Access denied");
  }

  const record = await FinancialRecord.create({
    ...validated,
    tenant_id: tenantId,
    created_by: actorUserId,
  });

  logAuditEvent({
    req: null,
    action: "financial.create",
    outcome: "success",
    actor: { id: actorUserId, role: actor?.role, email: actor?.email },
    tenant: { id: tenantId },
    target: { type: "financial_record", id: record.id },
    metadata: { club_id: record.club_id, type: record.type, amount: String(record.amount), category: record.category },
  });

  return record;
}

async function updateFinancialRecord({ tenantId, actorUserId, id, body }) {
  const recordId = parsePositiveInt(id);
  if (!recordId) {
    throw new ApiError(400, "VALIDATION_ERROR", "id must be a positive integer.");
  }

  const existing = await ensureRecord(tenantId, recordId);
  const actor = await User.findByPk(actorUserId);

  const mergedBody = {
    club_id: body.club_id ?? existing.club_id,
    type: body.type ?? existing.type,
    amount: body.amount ?? existing.amount,
    category: body.category ?? existing.category,
    description: body.description ?? existing.description,
    transaction_date: body.transaction_date ?? existing.transaction_date,
  };
  const { errors, payload: validated } = buildValidationPayload(mergedBody);
  if (errors.length > 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Validation failed", errors);
  }

  await ensureClub(tenantId, validated.club_id);

  const allowed = await canWriteFinancial(tenantId, actorUserId, validated.club_id);
  if (!allowed) {
    throw new ApiError(403, "AUTHORIZATION_DENIED", "Access denied");
  }

  await existing.update({ ...validated });

  logAuditEvent({
    req: null,
    action: "financial.update",
    outcome: "success",
    actor: { id: actorUserId, role: actor?.role, email: actor?.email },
    tenant: { id: tenantId },
    target: { type: "financial_record", id: existing.id },
    metadata: { club_id: existing.club_id, type: existing.type, amount: String(existing.amount), category: existing.category },
  });

  return existing;
}

async function deleteFinancialRecord({ tenantId, actorUserId, id }) {
  const recordId = parsePositiveInt(id);
  if (!recordId) {
    throw new ApiError(400, "VALIDATION_ERROR", "id must be a positive integer.");
  }

  const existing = await ensureRecord(tenantId, recordId);
  const actor = await User.findByPk(actorUserId);

  const allowed = await canWriteFinancial(tenantId, actorUserId, existing.club_id);
  if (!allowed) {
    throw new ApiError(403, "AUTHORIZATION_DENIED", "Access denied");
  }

  await existing.destroy();

  logAuditEvent({
    req: null,
    action: "financial.delete",
    outcome: "success",
    actor: { id: actorUserId, role: actor?.role, email: actor?.email },
    tenant: { id: tenantId },
    target: { type: "financial_record", id: existing.id },
    metadata: { club_id: existing.club_id, type: existing.type },
  });
}

async function getFinancialMonthlySummary({ tenantId, clubId, year, month }) {
  if (!year || !month) {
    throw new ApiError(400, "VALIDATION_ERROR", "year and month are required.");
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const where = { transaction_date: { [Op.gte]: start, [Op.lt]: end }, tenant_id: tenantId };
  if (clubId) where.club_id = clubId;

  const rows = await FinancialRecord.findAll({
    where,
    attributes: [
      "type",
      [fn("SUM", col("amount")), "total_amount"],
      [fn("COUNT", col("id")), "record_count"],
    ],
    group: ["type"],
  });

  const summary = { income: 0, expense: 0, income_count: 0, expense_count: 0 };
  rows.forEach((row) => {
    const type = row.get("type");
    const total = Number.parseFloat(row.get("total_amount") || 0);
    const count = Number.parseInt(row.get("record_count"), 10) || 0;
    if (type === "income") { summary.income = total; summary.income_count = count; }
    else if (type === "expense") { summary.expense = total; summary.expense_count = count; }
  });

  return {
    year, month, club_id: clubId,
    summary: { ...summary, net: Number((summary.income - summary.expense).toFixed(2)) },
  };
}

async function getFinancialYearlySummary({ tenantId, clubId, year }) {
  if (!year) {
    throw new ApiError(400, "VALIDATION_ERROR", "year is required.");
  }

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const where = { transaction_date: { [Op.gte]: start, [Op.lt]: end }, tenant_id: tenantId };
  if (clubId) where.club_id = clubId;

  const rows = await FinancialRecord.findAll({
    where,
    attributes: [
      [literal("MONTH(transaction_date)"), "month"],
      "type",
      [fn("SUM", col("amount")), "total_amount"],
      [fn("COUNT", col("id")), "record_count"],
    ],
    group: [literal("MONTH(transaction_date)"), "type"],
    order: [[literal("MONTH(transaction_date)"), "ASC"]],
  });

  const monthMap = {};
  for (let m = 1; m <= 12; m += 1) {
    monthMap[m] = { month: m, income: 0, expense: 0, income_count: 0, expense_count: 0, net: 0 };
  }

  rows.forEach((row) => {
    const m = Number.parseInt(row.get("month"), 10);
    const type = row.get("type");
    const total = Number.parseFloat(row.get("total_amount") || 0);
    const count = Number.parseInt(row.get("record_count"), 10) || 0;
    if (!monthMap[m]) return;
    if (type === "income") { monthMap[m].income = total; monthMap[m].income_count = count; }
    else if (type === "expense") { monthMap[m].expense = total; monthMap[m].expense_count = count; }
    monthMap[m].net = Number((monthMap[m].income - monthMap[m].expense).toFixed(2));
  });

  const monthly = Object.values(monthMap);
  const totals = monthly.reduce(
    (acc, item) => {
      acc.income += item.income; acc.expense += item.expense;
      acc.income_count += item.income_count; acc.expense_count += item.expense_count;
      return acc;
    },
    { income: 0, expense: 0, income_count: 0, expense_count: 0 }
  );

  return { year, club_id: clubId, totals: { ...totals, net: Number((totals.income - totals.expense).toFixed(2)) }, monthly };
}

async function getFinancialAggregates({ tenantId, clubId, year, month }) {
  const where = { tenant_id: tenantId };
  if (clubId) where.club_id = clubId;

  if (year && month) {
    where.transaction_date = {
      [Op.gte]: new Date(Date.UTC(year, month - 1, 1)),
      [Op.lt]: new Date(Date.UTC(year, month, 1)),
    };
  } else if (year) {
    where.transaction_date = {
      [Op.gte]: new Date(Date.UTC(year, 0, 1)),
      [Op.lt]: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  const [totals, byCategory] = await Promise.all([
    FinancialRecord.findAll({
      where,
      attributes: ["type", [fn("SUM", col("amount")), "total_amount"], [fn("COUNT", col("id")), "record_count"]],
      group: ["type"],
    }),
    FinancialRecord.findAll({
      where,
      attributes: ["type", "category", [fn("SUM", col("amount")), "total_amount"], [fn("COUNT", col("id")), "record_count"]],
      group: ["type", "category"],
      order: [[fn("SUM", col("amount")), "DESC"]],
    }),
  ]);

  let income = 0, expense = 0, incomeCount = 0, expenseCount = 0;
  totals.forEach((row) => {
    const type = row.get("type");
    const total = Number.parseFloat(row.get("total_amount") || 0);
    const count = Number.parseInt(row.get("record_count"), 10) || 0;
    if (type === "income") { income = total; incomeCount = count; }
    else if (type === "expense") { expense = total; expenseCount = count; }
  });

  return {
    filters: { year, month, club_id: clubId },
    totals: { income, expense, net: Number((income - expense).toFixed(2)), income_count: incomeCount, expense_count: expenseCount },
    by_category: byCategory.map((row) => ({
      type: row.get("type"),
      category: row.get("category"),
      total_amount: Number.parseFloat(row.get("total_amount") || 0),
      record_count: Number.parseInt(row.get("record_count"), 10) || 0,
    })),
  };
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
