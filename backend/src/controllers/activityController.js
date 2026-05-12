const { Op } = require("sequelize");
const { validationResult } = require("express-validator");
const {
  Activity,
  Approval,
  Club,
  ClubMember,
  TenantMembership,
  User,
} = require("../models");
const { isTenantGuardError, requireTenant } = require("../utils/tenantGuard");
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

function toTenantSafeError(res, error) {
  return res.status(error.status || 400).json({
    success: false,
    message: error.message || "Invalid tenant context.",
    code: error.code || "TENANT_CONTEXT_INVALID",
  });
}

function validationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    code: "VALIDATION_ERROR",
    errors,
  });
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeActivityStatus(status) {
  if (status === "pending") {
    return ACTIVITY_STATUS.PENDING;
  }
  return status;
}

function isGlobalPrivileged(req) {
  const globalRole = req.user && req.user.role;
  return globalRole === "system_admin";
}

async function resolveTenantMembershipRole(req) {
  const tenant = requireTenant(req);
  const membership = await TenantMembership.findOne({
    where: {
      tenant_id: tenant.id,
      user_id: req.user.id,
    },
  });
  return membership ? membership.role : null;
}

async function resolveClubForTenant(req, clubId) {
  const tenant = requireTenant(req);
  return Club.findOne({
    where: {
      id: clubId,
      tenant_id: tenant.id,
    },
  });
}

async function canManageClub(req, club) {
  if (isGlobalPrivileged(req)) {
    return true;
  }

  const tenantRole = await resolveTenantMembershipRole(req);
  if (tenantRole === "tenant_admin") {
    return true;
  }

  if (club.founder_id === req.user.id) {
    return true;
  }

  const clubMembership = await ClubMember.findOne({
    where: {
      tenant_id: club.tenant_id,
      club_id: club.id,
      user_id: req.user.id,
      role: {
        [Op.in]: ["founder", "admin"],
      },
    },
  });

  return Boolean(clubMembership);
}

async function canAccessClub(req, club) {
  if (isGlobalPrivileged(req)) {
    return true;
  }

  const tenantRole = await resolveTenantMembershipRole(req);
  if (tenantRole === "tenant_admin") {
    return true;
  }

  if (club.founder_id === req.user.id) {
    return true;
  }

  const clubMembership = await ClubMember.findOne({
    where: {
      tenant_id: club.tenant_id,
      club_id: club.id,
      user_id: req.user.id,
    },
  });

  return Boolean(clubMembership);
}

async function listAccessibleClubIds(req, tenantId) {
  const foundedClubs = await Club.findAll({
    where: {
      tenant_id: tenantId,
      founder_id: req.user.id,
    },
    attributes: ["id"],
  });

  const joinedClubs = await ClubMember.findAll({
    where: {
      tenant_id: tenantId,
      user_id: req.user.id,
    },
    attributes: ["club_id"],
  });

  return [
    ...new Set([
      ...foundedClubs.map((club) => club.id),
      ...joinedClubs.map((membership) => membership.club_id),
    ]),
  ];
}

async function createActivity(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }

  try {
    const tenant = requireTenant(req);
    const clubId = parsePositiveInt(req.body.club_id);
    const club = await resolveClubForTenant(req, clubId);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found in current tenant.",
        code: "CLUB_NOT_FOUND",
      });
    }

    const permitted = await canManageClub(req, club);
    if (!permitted) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create activities for this club.",
        code: "ACTIVITY_OWNERSHIP_DENIED",
      });
    }

    const activity = await Activity.create({
      tenant_id: tenant.id,
      club_id: clubId,
      title: req.body.title.trim(),
      description: req.body.description ? req.body.description.trim() : null,
      start_time: req.body.start_time,
      end_time: req.body.end_time || null,
      location: req.body.location ? req.body.location.trim() : null,
      status: ACTIVITY_STATUS.DRAFT,
      created_by: req.user.id,
    });

    return res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function listActivities(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }

  try {
    const tenant = requireTenant(req);
    const status = normalizeActivityStatus(req.query.status || null);
    const where = {
      tenant_id: tenant.id,
    };
    if (status) {
      where.status = status;
    }

    if (!isGlobalPrivileged(req)) {
      const tenantRole = await resolveTenantMembershipRole(req);
      if (tenantRole !== "tenant_admin") {
        const accessibleClubIds = await listAccessibleClubIds(req, tenant.id);
        if (!accessibleClubIds.length) {
          return res.status(200).json({
            success: true,
            data: [],
          });
        }
        where.club_id = {
          [Op.in]: accessibleClubIds,
        };
      }
    }

    const activities = await Activity.findAll({
      where,
      order: [["start_time", "DESC"]],
      include: [
        { model: Club, as: "club", attributes: ["id", "name", "status"] },
        { model: User, as: "creator", attributes: ["id", "username", "email"] },
      ],
    });

    return res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function getActivityById(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }

  try {
    const tenant = requireTenant(req);
    const id = parsePositiveInt(req.params.id);
    const activity = await Activity.findOne({
      where: {
        id,
        tenant_id: tenant.id,
      },
      include: [
        { model: Club, as: "club", attributes: ["id", "name", "founder_id", "status"] },
        { model: User, as: "creator", attributes: ["id", "username", "email"] },
      ],
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found.",
        code: "ACTIVITY_NOT_FOUND",
      });
    }

    const permitted = await canAccessClub(req, activity.club);
    if (!permitted) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this activity.",
        code: "ACTIVITY_OWNERSHIP_DENIED",
      });
    }

    return res.status(200).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

function validateStatusPatchTransition(currentStatus, nextStatus) {
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

async function updateActivity(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }

  try {
    const tenant = requireTenant(req);
    const id = parsePositiveInt(req.params.id);
    const activity = await Activity.findOne({
      where: {
        id,
        tenant_id: tenant.id,
      },
      include: [{ model: Club, as: "club", attributes: ["id", "tenant_id", "founder_id"] }],
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found.",
        code: "ACTIVITY_NOT_FOUND",
      });
    }

    const permitted = await canManageClub(req, activity.club);
    if (!permitted) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this activity.",
        code: "ACTIVITY_OWNERSHIP_DENIED",
      });
    }

    const nextStatus = req.body.status || null;
    const statusTransition = validateStatusPatchTransition(activity.status, nextStatus);
    if (!statusTransition.ok) {
      return res.status(409).json({
        success: false,
        message: statusTransition.message,
        code: "ACTIVITY_STATUS_TRANSITION_INVALID",
      });
    }

    const payload = {};
    if (req.body.title !== undefined) {
      payload.title = req.body.title.trim();
    }
    if (req.body.description !== undefined) {
      payload.description = req.body.description ? req.body.description.trim() : null;
    }
    if (req.body.start_time !== undefined) {
      payload.start_time = req.body.start_time;
    }
    if (req.body.end_time !== undefined) {
      payload.end_time = req.body.end_time || null;
    }
    if (req.body.location !== undefined) {
      payload.location = req.body.location ? req.body.location.trim() : null;
    }
    if (nextStatus !== null) {
      payload.status = nextStatus;
    }

    const editingCoreFields =
      payload.title !== undefined ||
      payload.description !== undefined ||
      payload.start_time !== undefined ||
      payload.end_time !== undefined ||
      payload.location !== undefined;

    if (editingCoreFields && !EDITABLE_ACTIVITY_STATUSES.has(activity.status)) {
      return res.status(409).json({
        success: false,
        message: `Activity content can only be edited in ${ACTIVITY_STATUS.DRAFT} or ${ACTIVITY_STATUS.REJECTED}.`,
        code: "ACTIVITY_NOT_EDITABLE",
      });
    }

    const effectiveStart = payload.start_time || activity.start_time;
    const effectiveEnd = payload.end_time === undefined ? activity.end_time : payload.end_time;
    if (effectiveEnd && new Date(effectiveEnd).getTime() < new Date(effectiveStart).getTime()) {
      return res.status(400).json({
        success: false,
        message: "end_time must be after start_time.",
        code: "VALIDATION_ERROR",
      });
    }

    await activity.update(payload);

    return res.status(200).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function deleteActivity(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }

  try {
    const tenant = requireTenant(req);
    const id = parsePositiveInt(req.params.id);
    const activity = await Activity.findOne({
      where: {
        id,
        tenant_id: tenant.id,
      },
      include: [{ model: Club, as: "club", attributes: ["id", "tenant_id", "founder_id"] }],
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found.",
        code: "ACTIVITY_NOT_FOUND",
      });
    }

    const permitted = await canManageClub(req, activity.club);
    if (!permitted) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this activity.",
        code: "ACTIVITY_OWNERSHIP_DENIED",
      });
    }

    if (activity.status === ACTIVITY_STATUS.PENDING) {
      return res.status(409).json({
        success: false,
        message: "Pending approval activity cannot be deleted.",
        code: "ACTIVITY_PENDING_APPROVAL",
      });
    }

    await activity.destroy();

    return res.status(200).json({
      success: true,
      message: "Activity deleted.",
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function submitForApproval(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }

  try {
    const tenant = requireTenant(req);
    const id = parsePositiveInt(req.params.id);
    const approverId = parsePositiveInt(req.body.approver_id);

    const activity = await Activity.findOne({
      where: {
        id,
        tenant_id: tenant.id,
      },
      include: [{ model: Club, as: "club", attributes: ["id", "tenant_id", "founder_id"] }],
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found.",
        code: "ACTIVITY_NOT_FOUND",
      });
    }

    const permitted = await canManageClub(req, activity.club);
    if (!permitted) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to submit this activity.",
        code: "ACTIVITY_OWNERSHIP_DENIED",
      });
    }

    if (activity.status !== ACTIVITY_STATUS.DRAFT) {
      return res.status(409).json({
        success: false,
        message: "Only draft activities can be submitted for approval.",
        code: "ACTIVITY_STATUS_TRANSITION_INVALID",
      });
    }

    const approverUser = await User.findByPk(approverId);
    if (!approverUser) {
      return res.status(404).json({
        success: false,
        message: "Approver user not found.",
        code: "APPROVER_NOT_FOUND",
      });
    }

    const approverMembership = await TenantMembership.findOne({
      where: {
        tenant_id: tenant.id,
        user_id: approverId,
      },
    });
    if (!approverMembership) {
      return res.status(400).json({
        success: false,
        message: "Approver must belong to the current tenant.",
        code: "APPROVER_TENANT_MISMATCH",
      });
    }

    const existingApproval = await Approval.findOne({
      where: {
        tenant_id: tenant.id,
        activity_id: id,
        approver_id: approverId,
      },
    });
    if (existingApproval && existingApproval.status === "pending") {
      return res.status(409).json({
        success: false,
        message: "An approval request is already pending for this activity.",
        code: "APPROVAL_ALREADY_PENDING",
      });
    }

    const approvalPayload = {
      status: "pending",
      comments: req.body.comments ? req.body.comments.trim() : null,
    };

    let approval = existingApproval;
    if (approval) {
      await approval.update(approvalPayload);
    } else {
      approval = await Approval.create({
        tenant_id: tenant.id,
        activity_id: id,
        approver_id: approverId,
        ...approvalPayload,
      });
    }

    await activity.update({
      status: ACTIVITY_STATUS.PENDING,
    });

    return res.status(200).json({
      success: true,
      message: "Activity submitted for approval.",
      data: {
        activity,
        approval,
      },
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function listPendingApprovals(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }

  try {
    const tenant = requireTenant(req);
    const qStatus = req.query.status;
    let targetStatus = "pending";
    if (qStatus === "approved") targetStatus = "approved";
    if (qStatus === "rejected") targetStatus = "rejected";
    if (qStatus === "pending") targetStatus = "pending";

    const where = {
      tenant_id: tenant.id,
      status: targetStatus,
    };

    if (!isGlobalPrivileged(req)) {
      const tenantRole = await resolveTenantMembershipRole(req);
      if (tenantRole !== "tenant_admin") {
        where.approver_id = req.user.id;
      }
    }

    const pendingApprovals = await Approval.findAll({
      where,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: Activity,
          as: "activity",
          attributes: ["id", "club_id", "title", "status", "start_time", "end_time", "location"],
        },
        {
          model: User,
          as: "approver",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: pendingApprovals,
    });
  } catch (error) {
    if (isTenantGuardError(error)) {
      return toTenantSafeError(res, error);
    }
    return next(error);
  }
}

async function decideApproval(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }

  try {
    const tenant = requireTenant(req);
    const approvalId = parsePositiveInt(req.params.id);
    const decision = String(req.body.decision || "").trim().toLowerCase();
    if (!DECISION_VALUES.has(decision)) {
      return res.status(400).json({
        success: false,
        message: "decision must be approve or reject.",
        code: "VALIDATION_ERROR",
      });
    }

    const approval = await Approval.findOne({
      where: {
        id: approvalId,
        tenant_id: tenant.id,
      },
      include: [
        {
          model: Activity,
          as: "activity",
          include: [{ model: Club, as: "club", attributes: ["id", "tenant_id", "founder_id"] }],
        },
      ],
    });

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval request not found.",
        code: "APPROVAL_NOT_FOUND",
      });
    }

    if (approval.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending approvals can be decided.",
        code: "APPROVAL_ALREADY_DECIDED",
      });
    }

    if (!approval.activity || approval.activity.status !== ACTIVITY_STATUS.PENDING) {
      return res.status(409).json({
        success: false,
        message: "Activity is not in pending approval state.",
        code: "ACTIVITY_STATUS_TRANSITION_INVALID",
      });
    }

    const tenantRole = isGlobalPrivileged(req) ? "system_admin" : await resolveTenantMembershipRole(req);
    const canModerate = tenantRole === "tenant_admin" || tenantRole === "system_admin";
    if (!canModerate && approval.approver_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only decide approvals assigned to you.",
        code: "APPROVAL_OWNERSHIP_DENIED",
      });
    }

    const nextApprovalStatus = decision === "approve" ? "approved" : "rejected";
    const nextActivityStatus = decision === "approve" ? ACTIVITY_STATUS.APPROVED : ACTIVITY_STATUS.REJECTED;

    await approval.update({
      status: nextApprovalStatus,
      comments: req.body.comments ? req.body.comments.trim() : null,
    });
    await approval.activity.update({
      status: nextActivityStatus,
    });

    logAuditEvent({
      req,
      action: "approval.decision",
      outcome: "success",
      target: {
        type: "approval",
        id: approval.id,
      },
      metadata: {
        decision,
        approval_status: nextApprovalStatus,
        activity_id: approval.activity_id,
        activity_status: nextActivityStatus,
      },
    });

    return res.status(200).json({
      success: true,
      message: decision === "approve" ? "Activity approved." : "Activity rejected.",
      data: {
        approval,
        activity: approval.activity,
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
  createActivity,
  listActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  submitForApproval,
  listPendingApprovals,
  decideApproval,
};
