const { Op } = require("sequelize");
const { sequelize, Reimbursement, Club, ClubMember, User, FinancialRecord } = require("../models");
const { ApiError } = require("../utils/common");

async function managedClubs(tenantId, actorId, clubId) {
  const memberships = await ClubMember.findAll({
    where: { tenant_id: tenantId, user_id: actorId, role: ["founder", "admin"] },
    attributes: ["club_id"],
  });
  return Club.findAll({
    where: {
      tenant_id: tenantId,
      status: "active",
      ...(clubId ? { id: clubId } : {}),
      [Op.or]: [{ founder_id: actorId }, { id: memberships.map(({ club_id }) => club_id) }],
    },
    attributes: ["id", "name"],
    order: [["name", "ASC"]],
  });
}

async function requireManagedClub(tenantId, actorId, clubId) {
  if (!(await managedClubs(tenantId, actorId, clubId)).length) {
    throw new ApiError(403, "REIMBURSEMENT_CLUB_DENIED", "只能为自己管理的在用社团提交报销。");
  }
}

function applicationFields(input) {
  const { category, amount, expense_date, purpose, receipt_reference } = input;
  return { category, amount, expense_date, purpose, receipt_reference };
}

async function list({ tenantId, actorId, canReview, scope, status }) {
  if (scope === "review" && !canReview) {
    throw new ApiError(403, "REIMBURSEMENT_REVIEW_DENIED", "当前账号没有报销审核权限。");
  }
  const [clubs, requests] = await Promise.all([
    managedClubs(tenantId, actorId),
    Reimbursement.findAll({
      attributes: { exclude: ["request_key"] },
      where: {
        tenant_id: tenantId,
        ...(scope === "review" ? {} : { applicant_id: actorId }),
        ...(status ? { status } : {}),
      },
      include: [
        { model: Club, as: "club", attributes: ["name"], where: { tenant_id: tenantId } },
        { model: User, as: "applicant", attributes: ["id", "username"] },
        { model: User, as: "reviewer", attributes: ["username"] },
        { model: User, as: "bookkeeper", attributes: ["username"] },
        { model: FinancialRecord, as: "financial_record", attributes: ["id"], where: { tenant_id: tenantId }, required: false },
      ],
      order: [["updated_at", "DESC"], ["id", "DESC"]],
    }),
  ]);
  return { clubs, requests, can_review: canReview };
}

async function create({ tenantId, actorId, input }) {
  const where = { tenant_id: tenantId, applicant_id: actorId, request_key: input.request_key };
  const existing = await Reimbursement.findOne({ where });
  if (existing) return { request: existing, changed: false };
  await requireManagedClub(tenantId, actorId, input.club_id);
  const [request, created] = await Reimbursement.findOrCreate({
    where,
    defaults: { ...applicationFields(input), club_id: input.club_id },
  });
  return { request, changed: created };
}

function checkState(request, allowed) {
  if (!allowed.includes(request.status)) {
    throw new ApiError(409, "REIMBURSEMENT_STATE_CONFLICT", "该报销单当前状态无法执行此操作。");
  }
}

async function change({ tenantId, actorId, id, input }, action) {
  return sequelize.transaction(async (transaction) => {
    const request = await Reimbursement.findOne({
      where: { id, tenant_id: tenantId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!request) throw new ApiError(404, "REIMBURSEMENT_NOT_FOUND", "报销单不存在。");

    const isApplicant = request.applicant_id === actorId;
    const isApplicantAction = action === "resubmit" || action === "withdraw";
    if (isApplicantAction && !isApplicant) {
      throw new ApiError(404, "REIMBURSEMENT_NOT_FOUND", "报销单不存在。");
    }
    if (!isApplicantAction && isApplicant) {
      throw new ApiError(403, "REIMBURSEMENT_SELF_REVIEW", "请由其他管理员审核或入账。");
    }
    if (action === "book" && request.status === "booked" && request.payment_reference === input.payment_reference) {
      return { request, changed: false };
    }
    if (request.revision !== input.revision) {
      throw new ApiError(409, "REIMBURSEMENT_REVISION_CONFLICT", "报销单已有更新，请刷新后再操作。");
    }

    const revision = request.revision + 1;
    if (action === "resubmit") {
      checkState(request, ["returned"]);
      await requireManagedClub(tenantId, actorId, request.club_id);
      await request.update({
        ...applicationFields(input), status: "pending", revision,
        reviewer_id: null, reviewed_at: null, review_note: null,
      }, { transaction });
    } else if (action === "withdraw") {
      checkState(request, ["pending", "returned"]);
      await request.update({ status: "withdrawn", revision }, { transaction });
    } else if (action === "review") {
      checkState(request, ["pending"]);
      await request.update({
        status: input.decision === "approve" ? "approved" : "returned",
        revision,
        reviewer_id: actorId,
        reviewed_at: new Date(),
        review_note: input.review_note || null,
      }, { transaction });
    } else if (action === "book") {
      checkState(request, ["approved"]);
      const bookedAt = new Date();
      await FinancialRecord.create({
        tenant_id: tenantId,
        club_id: request.club_id,
        type: "expense",
        amount: request.amount,
        category: request.category,
        description: `报销单 #${request.id}`,
        transaction_date: bookedAt,
        created_by: actorId,
        reimbursement_id: request.id,
      }, { transaction });
      await request.update({
        status: "booked", revision, booked_at: bookedAt, booked_by: actorId,
        payment_reference: input.payment_reference,
      }, { transaction });
    } else {
      throw new Error(`Unknown reimbursement action: ${action}`);
    }
    return { request, changed: true };
  });
}

module.exports = { list, create, change };
