const { Op, fn, col, literal } = require("sequelize");
const { FinancialRecord, Club, ClubMember } = require("../models");
const { isTenantGuardError, tenantCreatePayload, tenantQueryOptions } = require("../utils/tenantGuard");
const { logAuditEvent } = require("../utils/auditLogger");

const RECORD_TYPES = new Set(["income", "expense"]);
const PUBLIC_READ_GLOBAL_ROLES = new Set(["system_admin", "platform_admin"]);
const WRITE_ALLOWED_GLOBAL_ROLES = new Set(["system_admin", "platform_admin", "club_admin"]);
const CLUB_WRITER_ROLES = new Set(["founder", "admin"]);

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
  if (typeof value !== "string") {
    return null;
  }
  const category = value.trim();
  if (!category || category.length > 100) {
    return null;
  }
  return category;
}

function parseMonth(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    return null;
  }
  return parsed;
}

function parseYear(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1970 || parsed > 9999) {
    return null;
  }
  return parsed;
}

function normalizeRole(role) {
  if (role === "student") {
    return "member";
  }
  return role || null;
}

async function ensureClubInTenant(req, clubId) {
  const club = await Club.findOne(
    tenantQueryOptions(req, {
      where: { id: clubId },
    })
  );
  return club;
}

async function ensureRecordInTenant(req, id) {
  return FinancialRecord.findOne(
    tenantQueryOptions(req, {
      where: { id },
    })
  );
}

async function resolveClubRole(req, clubId) {
  if (!req.user || !req.user.id) {
    return null;
  }

  const membership = await ClubMember.findOne(
    tenantQueryOptions(req, {
      where: {
        club_id: clubId,
        user_id: req.user.id,
      },
    })
  );
  return membership ? membership.role : null;
}

async function canReadFinancial(req) {
  if (!req.user) {
    return true;
  }

  const actorGlobalRole = normalizeRole(req.user.role);
  if (PUBLIC_READ_GLOBAL_ROLES.has(actorGlobalRole)) {
    return true;
  }

  return true;
}

async function canWriteFinancial(req, clubId) {
  if (!req.user) {
    return false;
  }

  const actorGlobalRole = normalizeRole(req.user.role);
  if (WRITE_ALLOWED_GLOBAL_ROLES.has(actorGlobalRole)) {
    return true;
  }

  const clubRole = await resolveClubRole(req, clubId);
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

  if (!clubId) {
    errors.push("club_id must be a positive integer.");
  }
  if (!RECORD_TYPES.has(type)) {
    errors.push("type must be income or expense.");
  }
  if (!amount) {
    errors.push("amount must be a positive number.");
  }
  if (!category) {
    errors.push("category is required and must be <= 100 chars.");
  }
  if (!transactionDate) {
    errors.push("transaction_date must be a valid date.");
  }

  return {
    errors,
    payload: {
      club_id: clubId,
      type,
      amount,
      category,
      description,
      transaction_date: transactionDate,
    },
  };
}

async function listFinancialRecords(req, res, next) {
  try {
    const allowed = await canReadFinancial(req);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        code: "AUTHORIZATION_DENIED",
      });
    }

    const clubId = parsePositiveInt(req.query.club_id);
    const type = typeof req.query.type === "string" ? req.query.type.trim() : null;
    const category = typeof req.query.category === "string" ? req.query.category.trim() : null;
    const year = req.query.year ? parseYear(req.query.year) : null;
    const month = req.query.month ? parseMonth(req.query.month) : null;
    const limit = req.query.limit ? Math.min(parsePositiveInt(req.query.limit) || 50, 200) : 50;

    if (req.query.month && !month) {
      return res.status(400).json({
        success: false,
        message: "month must be between 1 and 12.",
        code: "VALIDATION_ERROR",
      });
    }

    if (req.query.year && !year) {
      return res.status(400).json({
        success: false,
        message: "year must be a valid 4-digit year.",
        code: "VALIDATION_ERROR",
      });
    }

    if (type && !RECORD_TYPES.has(type)) {
      return res.status(400).json({
        success: false,
        message: "type must be income or expense.",
        code: "VALIDATION_ERROR",
      });
    }

    const where = {};
    if (clubId) {
      where.club_id = clubId;
    }
    if (type) {
      where.type = type;
    }
    if (category) {
      where.category = category;
    }
    if (year && month) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      where.transaction_date = {
        [Op.gte]: start,
        [Op.lt]: end,
      };
    } else if (year) {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      where.transaction_date = {
        [Op.gte]: start,
        [Op.lt]: end,
      };
    }

    const records = await FinancialRecord.findAll(
      tenantQueryOptions(req, {
        where,
        order: [
          ["transaction_date", "DESC"],
          ["id", "DESC"],
        ],
        limit,
      })
    );

    return res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function getFinancialRecord(req, res, next) {
  try {
    const allowed = await canReadFinancial(req);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        code: "AUTHORIZATION_DENIED",
      });
    }

    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const record = await ensureRecordInTenant(req, id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Financial record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function createFinancialRecord(req, res, next) {
  try {
    const { errors, payload } = buildValidationPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    const club = await ensureClubInTenant(req, payload.club_id);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found in tenant scope.",
      });
    }

    const allowed = await canWriteFinancial(req, payload.club_id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        code: "AUTHORIZATION_DENIED",
      });
    }

    const record = await FinancialRecord.create(
      tenantCreatePayload(req, {
        ...payload,
        created_by: req.user.id,
      })
    );

    logAuditEvent({
      req,
      action: "financial.create",
      outcome: "success",
      target: {
        type: "financial_record",
        id: record.id,
      },
      metadata: {
        club_id: record.club_id,
        type: record.type,
        amount: String(record.amount),
        category: record.category,
      },
    });

    return res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function updateFinancialRecord(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const existing = await ensureRecordInTenant(req, id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Financial record not found.",
      });
    }

    const mergedBody = {
      club_id: req.body.club_id ?? existing.club_id,
      type: req.body.type ?? existing.type,
      amount: req.body.amount ?? existing.amount,
      category: req.body.category ?? existing.category,
      description: req.body.description ?? existing.description,
      transaction_date: req.body.transaction_date ?? existing.transaction_date,
    };
    const { errors, payload } = buildValidationPayload(mergedBody);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    const club = await ensureClubInTenant(req, payload.club_id);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found in tenant scope.",
      });
    }

    const allowed = await canWriteFinancial(req, payload.club_id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        code: "AUTHORIZATION_DENIED",
      });
    }

    await existing.update({
      ...payload,
    });

    logAuditEvent({
      req,
      action: "financial.update",
      outcome: "success",
      target: {
        type: "financial_record",
        id: existing.id,
      },
      metadata: {
        club_id: existing.club_id,
        type: existing.type,
        amount: String(existing.amount),
        category: existing.category,
      },
    });

    return res.status(200).json({
      success: true,
      data: existing,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function deleteFinancialRecord(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const existing = await ensureRecordInTenant(req, id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Financial record not found.",
      });
    }

    const allowed = await canWriteFinancial(req, existing.club_id);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        code: "AUTHORIZATION_DENIED",
      });
    }

    await existing.destroy();
    logAuditEvent({
      req,
      action: "financial.delete",
      outcome: "success",
      target: {
        type: "financial_record",
        id: existing.id,
      },
      metadata: {
        club_id: existing.club_id,
        type: existing.type,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Financial record deleted.",
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function getFinancialMonthlySummary(req, res, next) {
  try {
    const year = parseYear(req.query.year);
    const month = parseMonth(req.query.month);
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "year and month are required and must be valid.",
        code: "VALIDATION_ERROR",
      });
    }

    const clubId = req.query.club_id ? parsePositiveInt(req.query.club_id) : null;
    if (req.query.club_id && !clubId) {
      return res.status(400).json({
        success: false,
        message: "club_id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const where = {
      transaction_date: {
        [Op.gte]: start,
        [Op.lt]: end,
      },
    };
    if (clubId) {
      where.club_id = clubId;
    }

    const rows = await FinancialRecord.findAll(
      tenantQueryOptions(req, {
        where,
        attributes: [
          "type",
          [fn("SUM", col("amount")), "total_amount"],
          [fn("COUNT", col("id")), "record_count"],
        ],
        group: ["type"],
      })
    );

    const summary = {
      income: 0,
      expense: 0,
      income_count: 0,
      expense_count: 0,
    };

    rows.forEach((row) => {
      const type = row.get("type");
      const totalAmount = Number.parseFloat(row.get("total_amount") || 0);
      const recordCount = Number.parseInt(row.get("record_count"), 10) || 0;
      if (type === "income") {
        summary.income = totalAmount;
        summary.income_count = recordCount;
      } else if (type === "expense") {
        summary.expense = totalAmount;
        summary.expense_count = recordCount;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        year,
        month,
        club_id: clubId,
        summary: {
          ...summary,
          net: Number((summary.income - summary.expense).toFixed(2)),
        },
      },
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function getFinancialYearlySummary(req, res, next) {
  try {
    const year = parseYear(req.query.year);
    if (!year) {
      return res.status(400).json({
        success: false,
        message: "year is required and must be valid.",
        code: "VALIDATION_ERROR",
      });
    }

    const clubId = req.query.club_id ? parsePositiveInt(req.query.club_id) : null;
    if (req.query.club_id && !clubId) {
      return res.status(400).json({
        success: false,
        message: "club_id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const where = {
      transaction_date: {
        [Op.gte]: start,
        [Op.lt]: end,
      },
    };
    if (clubId) {
      where.club_id = clubId;
    }

    const rows = await FinancialRecord.findAll(
      tenantQueryOptions(req, {
        where,
        attributes: [
          [literal("MONTH(transaction_date)"), "month"],
          "type",
          [fn("SUM", col("amount")), "total_amount"],
          [fn("COUNT", col("id")), "record_count"],
        ],
        group: [literal("MONTH(transaction_date)"), "type"],
        order: [[literal("MONTH(transaction_date)"), "ASC"]],
      })
    );

    const monthMap = {};
    for (let m = 1; m <= 12; m += 1) {
      monthMap[m] = {
        month: m,
        income: 0,
        expense: 0,
        income_count: 0,
        expense_count: 0,
        net: 0,
      };
    }

    rows.forEach((row) => {
      const month = Number.parseInt(row.get("month"), 10);
      const type = row.get("type");
      const totalAmount = Number.parseFloat(row.get("total_amount") || 0);
      const recordCount = Number.parseInt(row.get("record_count"), 10) || 0;

      if (!monthMap[month]) {
        return;
      }
      if (type === "income") {
        monthMap[month].income = totalAmount;
        monthMap[month].income_count = recordCount;
      } else if (type === "expense") {
        monthMap[month].expense = totalAmount;
        monthMap[month].expense_count = recordCount;
      }
      monthMap[month].net = Number((monthMap[month].income - monthMap[month].expense).toFixed(2));
    });

    const monthly = Object.values(monthMap);
    const totals = monthly.reduce(
      (acc, item) => {
        acc.income += item.income;
        acc.expense += item.expense;
        acc.income_count += item.income_count;
        acc.expense_count += item.expense_count;
        return acc;
      },
      { income: 0, expense: 0, income_count: 0, expense_count: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        year,
        club_id: clubId,
        totals: {
          ...totals,
          net: Number((totals.income - totals.expense).toFixed(2)),
        },
        monthly,
      },
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function getFinancialAggregates(req, res, next) {
  try {
    const year = req.query.year ? parseYear(req.query.year) : null;
    const month = req.query.month ? parseMonth(req.query.month) : null;
    const clubId = req.query.club_id ? parsePositiveInt(req.query.club_id) : null;

    if (req.query.year && !year) {
      return res.status(400).json({
        success: false,
        message: "year must be valid.",
        code: "VALIDATION_ERROR",
      });
    }

    if (req.query.month && !month) {
      return res.status(400).json({
        success: false,
        message: "month must be between 1 and 12.",
        code: "VALIDATION_ERROR",
      });
    }

    if (req.query.club_id && !clubId) {
      return res.status(400).json({
        success: false,
        message: "club_id must be a positive integer.",
        code: "VALIDATION_ERROR",
      });
    }

    const where = {};
    if (clubId) {
      where.club_id = clubId;
    }

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
      FinancialRecord.findAll(
        tenantQueryOptions(req, {
          where,
          attributes: [
            "type",
            [fn("SUM", col("amount")), "total_amount"],
            [fn("COUNT", col("id")), "record_count"],
          ],
          group: ["type"],
        })
      ),
      FinancialRecord.findAll(
        tenantQueryOptions(req, {
          where,
          attributes: [
            "type",
            "category",
            [fn("SUM", col("amount")), "total_amount"],
            [fn("COUNT", col("id")), "record_count"],
          ],
          group: ["type", "category"],
          order: [[fn("SUM", col("amount")), "DESC"]],
        })
      ),
    ]);

    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    totals.forEach((row) => {
      const type = row.get("type");
      const totalAmount = Number.parseFloat(row.get("total_amount") || 0);
      const recordCount = Number.parseInt(row.get("record_count"), 10) || 0;
      if (type === "income") {
        income = totalAmount;
        incomeCount = recordCount;
      } else if (type === "expense") {
        expense = totalAmount;
        expenseCount = recordCount;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        filters: {
          year,
          month,
          club_id: clubId,
        },
        totals: {
          income,
          expense,
          net: Number((income - expense).toFixed(2)),
          income_count: incomeCount,
          expense_count: expenseCount,
        },
        by_category: byCategory.map((row) => ({
          type: row.get("type"),
          category: row.get("category"),
          total_amount: Number.parseFloat(row.get("total_amount") || 0),
          record_count: Number.parseInt(row.get("record_count"), 10) || 0,
        })),
      },
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
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
