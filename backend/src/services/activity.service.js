const { Op } = require("sequelize");
const {
  Activity,
  Approval,
  Club,
  ClubMember,
  TenantMembership,
  User,
} = require("../models");
const { ApiError, parsePositiveInt } = require("../utils/common");
const { requireTenant } = require("../utils/tenantGuard");
const { logAuditEvent } = require("../utils/auditLogger");

const ACTIVITY_STATUS = {
  DRAFT: "draft",
  PENDING: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
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

async function ensureApproval(tenantId, approvalId) {
  const id = parsePositiveInt(approvalId);
  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "approval id must be a positive integer.");
  }
  const approval = await Approval.findOne({
    where: { id, tenant_id: tenantId },
    include: [
      {
        model: Activity,
        as: "activity",
        include: [{ model: Club, as: "club", attributes: ["id", "tenant_id", "founder_id"] }],
      },
      { model: User, as: "approver", attributes: ["id", "username", "email"] },
    ],
  });
  if (!approval) {
    throw new ApiError(404, "APPROVAL_NOT_FOUND", "Approval request not found.");
  }
  return approval;
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

async function ensureCanManageClub(tenantId, userId, club) {
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
    where: {
      tenant_id: tenantId,
      club_id: club.id,
      user_id: userId,
      role: { [Op.in]: ["founder", "admin"] },
    },
  });
  if (!clubMembership) {
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
    status: ACTIVITY_STATUS.DRAFT,
    created_by: actorUserId,
  });

  return activity;
}

async function listActivities({ tenantId, actorUserId, status, userRole }) {
  const where = { tenant_id: tenantId };
  const normalizedStatus = status ? normalizeActivityStatus(status) : null;
  if (normalizedStatus) {
    where.status = normalizedStatus;
  }

  if (!isGlobalPrivileged(userRole)) {
    const tenantRole = await resolveTenantMembershipRole(tenantId, actorUserId);
    if (tenantRole !== "tenant_admin") {
      const accessibleClubIds = await listAccessibleClubIds(tenantId, actorUserId);
      if (!accessibleClubIds.length) {
        return [];
      }
      where.club_id = { [Op.in]: accessibleClubIds };
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

  return Activity.findOne({
    where: { id: activity.id, tenant_id: tenantId },
    include: [
      { model: Club, as: "club", attributes: ["id", "name", "founder_id", "status"] },
      { model: User, as: "creator", attributes: ["id", "username", "email"] },
    ],
  });
}

async function updateActivity({ tenantId, actorUserId, activityId, payload }) {
  const activity = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, activity.club);

  const nextStatus = payload.status || null;
  const statusTransition = validateStatusTransition(activity.status, nextStatus);
  if (!statusTransition.ok) {
    throw new ApiError(409, "ACTIVITY_STATUS_TRANSITION_INVALID", statusTransition.message);
  }

  const updates = {};
  if (payload.title !== undefined) updates.title = payload.title.trim();
  if (payload.description !== undefined) updates.description = payload.description ? payload.description.trim() : null;
  if (payload.start_time !== undefined) updates.start_time = payload.start_time;
  if (payload.end_time !== undefined) updates.end_time = payload.end_time || null;
  if (payload.location !== undefined) updates.location = payload.location ? payload.location.trim() : null;
  if (nextStatus !== null) updates.status = nextStatus;

  const editingCoreFields =
    updates.title !== undefined ||
    updates.description !== undefined ||
    updates.start_time !== undefined ||
    updates.end_time !== undefined ||
    updates.location !== undefined;

  if (editingCoreFields && !EDITABLE_ACTIVITY_STATUSES.has(activity.status)) {
    throw new ApiError(409, "ACTIVITY_NOT_EDITABLE",
      `Activity content can only be edited in ${ACTIVITY_STATUS.DRAFT} or ${ACTIVITY_STATUS.REJECTED}.`);
  }

  const effectiveStart = updates.start_time || activity.start_time;
  const effectiveEnd = updates.end_time === undefined ? activity.end_time : updates.end_time;
  if (effectiveEnd && new Date(effectiveEnd).getTime() < new Date(effectiveStart).getTime()) {
    throw new ApiError(400, "VALIDATION_ERROR", "end_time must be after start_time.");
  }

  await activity.update(updates);
  return activity;
}

async function deleteActivity({ tenantId, actorUserId, activityId }) {
  const activity = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, activity.club);

  if (activity.status === ACTIVITY_STATUS.PENDING) {
    throw new ApiError(409, "ACTIVITY_PENDING_APPROVAL", "Pending approval activity cannot be deleted.");
  }

  await activity.destroy();
}

async function submitForApproval({ tenantId, actorUserId, activityId, approverId, comments }) {
  const activity = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, activity.club);

  if (activity.status !== ACTIVITY_STATUS.DRAFT) {
    throw new ApiError(409, "ACTIVITY_STATUS_TRANSITION_INVALID", "Only draft activities can be submitted for approval.");
  }

  const approverUserId = parsePositiveInt(approverId);
  if (!approverUserId) {
    throw new ApiError(400, "VALIDATION_ERROR", "approver_id must be a positive integer.");
  }

  const approverUser = await User.findByPk(approverUserId);
  if (!approverUser) {
    throw new ApiError(404, "APPROVER_NOT_FOUND", "Approver user not found.");
  }

  const approverMembership = await TenantMembership.findOne({
    where: { tenant_id: tenantId, user_id: approverUserId },
  });
  if (!approverMembership) {
    throw new ApiError(400, "APPROVER_TENANT_MISMATCH", "Approver must belong to the current tenant.");
  }

  const existingApproval = await Approval.findOne({
    where: { tenant_id: tenantId, activity_id: activityId, approver_id: approverUserId },
  });
  if (existingApproval && existingApproval.status === "pending") {
    throw new ApiError(409, "APPROVAL_ALREADY_PENDING", "An approval request is already pending for this activity.");
  }

  const approvalPayload = {
    status: "pending",
    comments: comments ? comments.trim() : null,
  };

  let approval = existingApproval;
  if (approval) {
    await approval.update(approvalPayload);
  } else {
    approval = await Approval.create({
      tenant_id: tenantId,
      activity_id: activityId,
      approver_id: approverUserId,
      ...approvalPayload,
    });
  }

  await activity.update({ status: ACTIVITY_STATUS.PENDING });

  return { activity, approval };
}

async function listPendingApprovals({ tenantId, actorUserId, status, userRole }) {
  let targetStatus = "pending";
  if (status === "approved") targetStatus = "approved";
  if (status === "rejected") targetStatus = "rejected";

  const where = { tenant_id: tenantId, status: targetStatus };

  if (!isGlobalPrivileged(userRole)) {
    const tenantRole = await resolveTenantMembershipRole(tenantId, actorUserId);
    if (tenantRole !== "tenant_admin") {
      where.approver_id = actorUserId;
    }
  }

  return Approval.findAll({
    where,
    order: [["created_at", "DESC"]],
    include: [
      { model: Activity, as: "activity", attributes: ["id", "club_id", "title", "status", "start_time", "end_time", "location"] },
      { model: User, as: "approver", attributes: ["id", "username", "email"] },
    ],
  });
}

async function decideApproval({ tenantId, actorUserId, approvalId, decision, comments, userRole }) {
  const approval = await ensureApproval(tenantId, approvalId);

  if (approval.status !== "pending") {
    throw new ApiError(409, "APPROVAL_ALREADY_DECIDED", "Only pending approvals can be decided.");
  }

  if (!approval.activity || approval.activity.status !== ACTIVITY_STATUS.PENDING) {
    throw new ApiError(409, "ACTIVITY_STATUS_TRANSITION_INVALID", "Activity is not in pending approval state.");
  }

  if (!DECISION_VALUES.has(decision)) {
    throw new ApiError(400, "VALIDATION_ERROR", "decision must be approve or reject.");
  }

  const tenantRole = await resolveTenantMembershipRole(tenantId, actorUserId);
  const canModerate = tenantRole === "tenant_admin" || isGlobalPrivileged(userRole);
  if (!canModerate && approval.approver_id !== actorUserId) {
    throw new ApiError(403, "APPROVAL_OWNERSHIP_DENIED", "You can only decide approvals assigned to you.");
  }

  const nextApprovalStatus = decision === "approve" ? "approved" : "rejected";
  const nextActivityStatus = decision === "approve" ? ACTIVITY_STATUS.APPROVED : ACTIVITY_STATUS.REJECTED;

  await approval.update({
    status: nextApprovalStatus,
    comments: comments ? comments.trim() : null,
  });
  await approval.activity.update({ status: nextActivityStatus });

  logAuditEvent({
    req: null,
    action: "approval.decision",
    outcome: "success",
    target: { type: "approval", id: approval.id },
    metadata: {
      decision,
      approval_status: nextApprovalStatus,
      activity_id: approval.activity_id,
      activity_status: nextActivityStatus,
      actor_id: actorUserId,
      tenant_id: tenantId,
    },
  });

  return { approval, activity: approval.activity };
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
};
