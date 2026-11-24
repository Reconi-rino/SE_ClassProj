const { Op } = require("sequelize");
const {
  sequelize,
  Activity,
  Approval,
  Club,
  ClubMember,
  TenantMembership,
  User,
} = require("../models");
const { ApiError, parsePositiveInt } = require("../utils/common");
const { logAuditEvent } = require("../utils/auditLogger");

const ACTIVITY_STATUS = {
  DRAFT: "draft",
  PENDING: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

const EDITABLE_ACTIVITY_STATUSES = new Set([ACTIVITY_STATUS.DRAFT, ACTIVITY_STATUS.REJECTED]);
const DECISION_VALUES = new Set(["approve", "reject"]);

function normalizeActivityStatus(status) {
  if (status === "pending") {
    return ACTIVITY_STATUS.PENDING;
  }
  return status;
}

function isGlobalPrivileged(userRole) {
  return userRole === "system_admin" || userRole === "platform_admin";
}

async function ensureClub(tenantId, clubId) {
  const id = parsePositiveInt(clubId);
  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "club_id must be a positive integer.");
  }
  const club = await Club.findOne({ where: { id, tenant_id: tenantId } });
  if (!club) {
    throw new ApiError(404, "CLUB_NOT_FOUND", "Club not found in current tenant.");
  }
  return club;
}

async function ensureActivity(tenantId, activityId) {
  const id = parsePositiveInt(activityId);
  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "activity id must be a positive integer.");
  }
  const activity = await Activity.findOne({
    where: { id, tenant_id: tenantId },
    include: [{ model: Club, as: "club", attributes: ["id", "tenant_id", "founder_id"] }],
  });
  if (!activity) {
    throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found.");
  }
  return activity;
}

async function lockActivity(tenantId, activityId, transaction) {
  const id = parsePositiveInt(activityId);
  const activity = id && await Activity.findOne({
    where: { id, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE,
  });
  if (!activity) throw new ApiError(404, "ACTIVITY_NOT_FOUND", "活动不存在。");
  return activity;
}

async function ensureTenantMembership(tenantId, userId) {
  const user = await User.findByPk(userId);
  if (user && isGlobalPrivileged(user.role)) {
    return { role: "tenant_admin" };
  }
  const membership = await TenantMembership.findOne({
    where: { tenant_id: tenantId, user_id: userId },
  });
  if (!membership) {
    throw new ApiError(403, "TENANT_MEMBERSHIP_REQUIRED", "User is not a member of this tenant.");
  }
  return membership;
}

async function resolveTenantMembershipRole(tenantId, userId) {
  try {
    const membership = await ensureTenantMembership(tenantId, userId);
    return membership.role;
  } catch {
    return null;
  }
}

async function canManageClub(tenantId, userId, club) {
  if (isGlobalPrivileged((await User.findByPk(userId))?.role)) {
    return true;
  }
  const tenantRole = await resolveTenantMembershipRole(tenantId, userId);
  if (tenantRole === "tenant_admin") {
    return true;
  }
  if (club.founder_id === userId) {
    return true;
  }
  const clubMembership = await ClubMember.findOne({
    where: {
      tenant_id: tenantId,
      club_id: club.id,
      user_id: userId,
      role: { [Op.in]: ["founder", "admin"] },
    },
  });
  return Boolean(clubMembership);
}

async function ensureCanManageClub(tenantId, userId, club) {
  if (!(await canManageClub(tenantId, userId, club))) {
    throw new ApiError(403, "ACTIVITY_OWNERSHIP_DENIED", "You do not have permission to manage this club's activities.");
  }
}

async function ensureCanAccessClub(tenantId, userId, club) {
  if (isGlobalPrivileged((await User.findByPk(userId))?.role)) {
    return;
  }
  const tenantRole = await resolveTenantMembershipRole(tenantId, userId);
  if (tenantRole === "tenant_admin") {
    return;
  }
  if (club.founder_id === userId) {
    return;
  }
  const clubMembership = await ClubMember.findOne({
    where: { tenant_id: tenantId, club_id: club.id, user_id: userId },
  });
  if (!clubMembership) {
    throw new ApiError(403, "ACTIVITY_OWNERSHIP_DENIED", "You do not have permission to access this activity.");
  }
}

async function listAccessibleClubIds(tenantId, userId) {
  const foundedClubs = await Club.findAll({
    where: { tenant_id: tenantId, founder_id: userId },
    attributes: ["id"],
  });
  const joinedClubs = await ClubMember.findAll({
    where: { tenant_id: tenantId, user_id: userId },
    attributes: ["club_id"],
  });
  return [...new Set([...foundedClubs.map((c) => c.id), ...joinedClubs.map((m) => m.club_id)])];
}

function validateStatusTransition(currentStatus, nextStatus) {
  if (!nextStatus || nextStatus === currentStatus) {
    return { ok: true };
  }
  if (nextStatus === ACTIVITY_STATUS.DRAFT && currentStatus === ACTIVITY_STATUS.REJECTED) {
    return { ok: true };
  }
  if (nextStatus === ACTIVITY_STATUS.COMPLETED && currentStatus === ACTIVITY_STATUS.APPROVED) {
    return { ok: true };
  }
  return {
    ok: false,
    message: `Invalid status transition from ${currentStatus} to ${nextStatus}.`,
  };
}

async function createActivity({ tenantId, actorUserId, payload }) {
  const clubId = parsePositiveInt(payload.club_id);
  const club = await ensureClub(tenantId, clubId);
  await ensureCanManageClub(tenantId, actorUserId, club);

  const activity = await Activity.create({
    tenant_id: tenantId,
    club_id: clubId,
    title: payload.title.trim(),
    description: payload.description ? payload.description.trim() : null,
    start_time: payload.start_time,
    end_time: payload.end_time || null,
    location: payload.location ? payload.location.trim() : null,
    registration_capacity: payload.registration_capacity ?? null,
    status: ACTIVITY_STATUS.DRAFT,
    created_by: actorUserId,
  });

  return activity;
}

async function listActivities({ tenantId, actorUserId, status, userRole, clubId, startDate, endDate }) {
  const where = { tenant_id: tenantId };
  const normalizedStatus = status ? normalizeActivityStatus(status) : null;
  if (normalizedStatus) {
    where.status = normalizedStatus;
  }
  if (clubId) where.club_id = clubId;
  if (startDate || endDate) {
    where.start_time = {};
    if (startDate) where.start_time[Op.gte] = new Date(`${startDate}T00:00:00+08:00`);
    if (endDate) {
      where.start_time[Op.lt] = new Date(Date.parse(`${endDate}T00:00:00+08:00`) + 86400000);
    }
  }

  if (!isGlobalPrivileged(userRole)) {
    const tenantRole = await resolveTenantMembershipRole(tenantId, actorUserId);
    if (tenantRole !== "tenant_admin") {
      const accessibleClubIds = await listAccessibleClubIds(tenantId, actorUserId);
      if (!accessibleClubIds.length || (clubId && !accessibleClubIds.includes(clubId))) {
        return [];
      }
      if (!clubId) where.club_id = { [Op.in]: accessibleClubIds };
    }
  }

  return Activity.findAll({
    where,
    order: [["start_time", "DESC"]],
    include: [
      { model: Club, as: "club", attributes: ["id", "name", "status"] },
      { model: User, as: "creator", attributes: ["id", "username", "email"] },
    ],
  });
}

async function getActivityById({ tenantId, actorUserId, activityId }) {
  const activity = await ensureActivity(tenantId, activityId);
  await ensureCanAccessClub(tenantId, actorUserId, activity.club);

  const details = await Activity.findOne({
    where: { id: activity.id, tenant_id: tenantId },
    include: [
      { model: Club, as: "club", attributes: ["id", "name", "founder_id", "status"] },
      { model: User, as: "creator", attributes: ["id", "username", "email"] },
    ],
  });
  if (!details) {
    throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found.");
  }
  const review = details.status === ACTIVITY_STATUS.REJECTED ?
    await Approval.findOne({
      where: { tenant_id: tenantId, activity_id: activity.id, status: "rejected" },
      attributes: ["comments"], order: [["updated_at", "DESC"], ["id", "DESC"]],
    }) : null;
  return {
    ...details.toJSON(), review_comment: review?.comments ?? null,
    can_manage: await canManageClub(tenantId, actorUserId, activity.club),
    can_review: await resolveTenantMembershipRole(tenantId, actorUserId) === "tenant_admin",
  };
}

async function updateActivity({ tenantId, actorUserId, activityId, payload }) {
  const activity = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, activity.club);

  const nextStatus = payload.status || null;
  const statusTransition = validateStatusTransition(activity.status, nextStatus);
  if (!statusTransition.ok) {
    throw new ApiError(409, "ACTIVITY_STATUS_TRANSITION_INVALID", statusTransition.message);
  }
  if (nextStatus === ACTIVITY_STATUS.COMPLETED && activity.status !== nextStatus &&
      (activity.end_time || activity.start_time).getTime() > Date.now()) {
    throw new ApiError(409, "ACTIVITY_NOT_ENDED", "活动尚未结束，无法结项。");
  }

  const updates = {};
  if (payload.title !== undefined) updates.title = payload.title.trim();
  if (payload.description !== undefined) updates.description = payload.description ? payload.description.trim() : null;
  if (payload.start_time !== undefined) updates.start_time = payload.start_time;
  if (payload.end_time !== undefined) updates.end_time = payload.end_time || null;
  if (payload.location !== undefined) updates.location = payload.location ? payload.location.trim() : null;
  if (payload.registration_capacity !== undefined) updates.registration_capacity = payload.registration_capacity;
  if (nextStatus !== null) updates.status = nextStatus;

  const editingCoreFields =
    updates.title !== undefined ||
    updates.description !== undefined ||
    updates.start_time !== undefined ||
    updates.end_time !== undefined ||
    updates.location !== undefined ||
    updates.registration_capacity !== undefined;

  if (editingCoreFields && !EDITABLE_ACTIVITY_STATUSES.has(activity.status)) {
    throw new ApiError(409, "ACTIVITY_NOT_EDITABLE",
      `Activity content can only be edited in ${ACTIVITY_STATUS.DRAFT} or ${ACTIVITY_STATUS.REJECTED}.`);
  }

  const effectiveStart = updates.start_time || activity.start_time;
  const effectiveEnd = updates.end_time === undefined ? activity.end_time : updates.end_time;
  if (effectiveEnd && new Date(effectiveEnd).getTime() < new Date(effectiveStart).getTime()) {
    throw new ApiError(400, "VALIDATION_ERROR", "end_time must be after start_time.");
  }

  if (!Object.keys(updates).length) return activity;
  const [updated] = await Activity.update(updates, {
    where: { id: activity.id, tenant_id: tenantId, status: activity.status },
  });
  if (!updated) throw new ApiError(409, "ACTIVITY_NOT_EDITABLE", "活动状态已变化，请刷新后重试。");
  return activity.reload();
}

async function deleteActivity({ tenantId, actorUserId, activityId }) {
  const activity = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, activity.club);

  if (activity.status === ACTIVITY_STATUS.PENDING) {
    throw new ApiError(409, "ACTIVITY_PENDING_APPROVAL", "Pending approval activity cannot be deleted.");
  }
  if (!EDITABLE_ACTIVITY_STATUSES.has(activity.status)) {
    throw new ApiError(409, "ACTIVITY_HISTORY_REQUIRED", "已发布的活动需保留记录。未开始的活动可以取消。");
  }

  const removed = await Activity.destroy({ where: { id: activity.id, tenant_id: tenantId, status: activity.status } });
  if (!removed) throw new ApiError(409, "ACTIVITY_NOT_EDITABLE", "活动状态已变化，请刷新后重试。");
}

async function chooseReviewer({ tenantId, approverId, excludedIds, transaction }) {
  const admins = await TenantMembership.findAll({
    where: { tenant_id: tenantId, role: "tenant_admin" }, attributes: ["user_id"], transaction,
  });
  const reviewer = await User.findOne({
    where: {
      id: { [Op.notIn]: excludedIds, ...(approverId != null ? { [Op.eq]: parsePositiveInt(approverId) } : {}) },
      [Op.or]: [{ id: admins.map(({ user_id }) => user_id) }, { role: ["system_admin", "platform_admin"] }],
    },
    attributes: ["id"], order: [["id", "ASC"]], transaction,
  });
  if (!reviewer) {
    if (approverId != null) throw new ApiError(400, "APPROVER_NOT_ELIGIBLE", "请选择非申请人且有审批权限的管理员。");
    throw new ApiError(409, "NO_ELIGIBLE_APPROVER", "当前没有可审批此活动的其他管理员。");
  }
  return reviewer.id;
}

async function submitForApproval({ tenantId, actorUserId, activityId, approverId, comments }) {
  const details = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, details.club);
  return sequelize.transaction(async (transaction) => {
    const activity = await lockActivity(tenantId, details.id, transaction);
    if (activity.status !== ACTIVITY_STATUS.DRAFT) {
      throw new ApiError(409, "ACTIVITY_STATUS_TRANSITION_INVALID", "只有草稿可以提交审批。");
    }
    const reviewerId = await chooseReviewer({
      tenantId, approverId, excludedIds: [activity.created_by, actorUserId], transaction,
    });
    const where = { tenant_id: tenantId, activity_id: activity.id, approver_id: reviewerId };
    const approvalPayload = {
      submitted_by: actorUserId, decided_by: null, status: "pending", comments: comments?.trim() || null,
    };
    let approval = await Approval.findOne({ where, transaction });
    if (approval) await approval.update(approvalPayload, { transaction });
    else approval = await Approval.create({ ...where, ...approvalPayload }, { transaction });
    await activity.update({ status: ACTIVITY_STATUS.PENDING }, { transaction });
    return { activity, approval };
  });
}

async function requireReviewer(tenantId, actorUserId) {
  if (await resolveTenantMembershipRole(tenantId, actorUserId) !== "tenant_admin") {
    throw new ApiError(403, "APPROVAL_ROLE_REQUIRED", "只有学校管理员可以审批活动。");
  }
}

async function listPendingApprovals({ tenantId, actorUserId, status }) {
  await requireReviewer(tenantId, actorUserId);
  let targetStatus = "pending";
  if (status === "approved") targetStatus = "approved";
  if (status === "rejected") targetStatus = "rejected";

  const approvals = await Approval.findAll({
    where: { tenant_id: tenantId, status: targetStatus },
    order: [["created_at", "DESC"]],
    include: [
      { model: Activity, as: "activity", attributes: ["id", "created_by", "club_id", "title", "status", "start_time", "end_time", "location"] },
      { model: User, as: "approver", attributes: ["id", "username"] },
      { model: User, as: "reviewer", attributes: ["id", "username"] },
    ],
  });
  return approvals.map((approval) => ({
    ...approval.toJSON(),
    can_decide: approval.status === "pending" && approval.activity?.status === ACTIVITY_STATUS.PENDING &&
      ![approval.submitted_by, approval.activity.created_by].includes(actorUserId),
  }));
}

async function decideApproval({ tenantId, actorUserId, approvalId, decision, comments }) {
  await requireReviewer(tenantId, actorUserId);
  if (!DECISION_VALUES.has(decision)) {
    throw new ApiError(400, "VALIDATION_ERROR", "decision must be approve or reject.");
  }
  const note = comments?.trim() || null;
  if (decision === "reject" && !note) {
    throw new ApiError(400, "REJECTION_REASON_REQUIRED", "请填写驳回原因。");
  }
  const where = { id: parsePositiveInt(approvalId), tenant_id: tenantId };
  const candidate = await Approval.findOne({ where, attributes: ["activity_id"] });
  if (!candidate) throw new ApiError(404, "APPROVAL_NOT_FOUND", "审批记录不存在。");
  const result = await sequelize.transaction(async (transaction) => {
    const activity = await lockActivity(tenantId, candidate.activity_id, transaction);
    const approval = await Approval.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
    if (!approval || approval.status !== "pending" || activity.status !== ACTIVITY_STATUS.PENDING) {
      throw new ApiError(409, "APPROVAL_ALREADY_DECIDED", "审批状态已变化，请刷新。");
    }
    if ([approval.submitted_by, activity.created_by].includes(actorUserId)) {
      throw new ApiError(403, "SELF_APPROVAL_DENIED", "请由其他管理员审核此活动。");
    }
    const status = decision === "approve" ? ACTIVITY_STATUS.APPROVED : ACTIVITY_STATUS.REJECTED;
    await approval.update({ status, comments: note, decided_by: actorUserId }, { transaction });
    await Approval.update({ status: "cancelled" }, {
      where: { tenant_id: tenantId, activity_id: activity.id, status: "pending", id: { [Op.ne]: approval.id } },
      transaction,
    });
    await activity.update({ status }, { transaction });
    return { approval, activity };
  });

  logAuditEvent({
    req: null,
    action: "approval.decision",
    outcome: "success",
    target: { type: "approval", id: result.approval.id },
    metadata: {
      decision,
      approval_status: result.approval.status,
      activity_id: result.activity.id,
      activity_status: result.activity.status,
      actor_id: actorUserId,
      tenant_id: tenantId,
    },
  });

  return result;
}

module.exports = {
  createActivity,
  listActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  submitForApproval,
  listPendingApprovals,
  decideApproval,
  ensureActivity,
  lockActivity,
  ensureCanManageClub,
};
