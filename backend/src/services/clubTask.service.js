const { Op } = require("sequelize");
const { ClubTask, Club, ClubMember, User, Activity } = require("../models");
const { ApiError, parsePositiveInt } = require("../utils/common");

async function ensureClubInTenant(tenantId, clubId) {
  const id = parsePositiveInt(clubId);
  if (!id) throw new ApiError(400, "VALIDATION_ERROR", "club_id must be a positive integer.");
  const club = await Club.findOne({ where: { id, tenant_id: tenantId } });
  if (!club) throw new ApiError(404, "CLUB_NOT_FOUND", "Club not found.");
  return club;
}

async function ensureClubTask(tenantId, taskId) {
  const id = parsePositiveInt(taskId);
  if (!id) throw new ApiError(400, "VALIDATION_ERROR", "task id must be a positive integer.");
  const task = await ClubTask.findOne({
    where: { id, tenant_id: tenantId },
    include: [
      { model: Club, as: "club", attributes: ["id", "name", "founder_id"] },
      { model: User, as: "assignee", attributes: ["id", "username", "email"] },
      { model: User, as: "creator", attributes: ["id", "username", "email"] },
    ],
  });
  if (!task) throw new ApiError(404, "CLUB_TASK_NOT_FOUND", "Club task not found.");
  return task;
}

async function ensureClubAdminOrFounder(tenantId, userId, clubId) {
  const user = await User.findByPk(userId);
  if (user && (user.role === "system_admin" || user.role === "platform_admin")) return;
  const membership = await ClubMember.findOne({
    where: { tenant_id: tenantId, club_id: clubId, user_id: userId, role: { [Op.in]: ["founder", "admin"] } },
  });
  if (!membership) {
    throw new ApiError(403, "CLUB_TASK_PERMISSION_DENIED", "Only club founder or admin can manage tasks.");
  }
}

async function ensureClubMember(tenantId, userId) {
  const user = await User.findByPk(userId);
  if (user && (user.role === "system_admin" || user.role === "platform_admin")) return;
  const isMember = await ClubMember.findOne({
    where: { tenant_id: tenantId, user_id: userId },
  });
  if (!isMember) {
    throw new ApiError(400, "ASSIGNEE_NOT_IN_CLUB", "Assignee is not a member of this tenant.");
  }
}

function parseAssigneeIds(value) {
  if (!value) return [];
  if (typeof value === "string") {
    return value.split(",").map((s) => parsePositiveInt(s.trim())).filter(Boolean);
  }
  return [];
}

async function validateActivityIfProvided(tenantId, clubId, activityId) {
  if (!activityId) return;
  const id = parsePositiveInt(activityId);
  if (!id) throw new ApiError(400, "VALIDATION_ERROR", "activity_id must be a positive integer.");
  const activity = await Activity.findOne({ where: { id, tenant_id: tenantId } });
  if (!activity) throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found.");
  if (activity.club_id !== parsePositiveInt(clubId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Activity does not belong to the specified club.");
  }
}

async function listClubTasks({ tenantId, clubId, actorUserId, assigneeId, status }) {
  await ensureClubInTenant(tenantId, clubId);
  const where = { tenant_id: tenantId, club_id: clubId };
  if (assigneeId) where.assignee_id = parsePositiveInt(assigneeId);
  if (status && ["pending", "in_progress", "completed"].includes(status)) where.status = status;

  return ClubTask.findAll({
    where,
    order: [["created_at", "DESC"]],
    include: [
      { model: Club, as: "club", attributes: ["id", "name"] },
      { model: User, as: "assignee", attributes: ["id", "username", "email"] },
      { model: User, as: "creator", attributes: ["id", "username", "email"] },
    ],
  });
}

async function listMyTasks({ tenantId, actorUserId }) {
  const tasks = await ClubTask.findAll({
    where: {
      tenant_id: tenantId,
      [Op.or]: [
        { assignee_id: actorUserId },
        { assignee_ids: { [Op.like]: `%${actorUserId}%` } },
      ],
    },
    order: [["created_at", "DESC"]],
    include: [
      { model: Club, as: "club", attributes: ["id", "name"] },
      { model: User, as: "assignee", attributes: ["id", "username", "email"] },
      { model: User, as: "creator", attributes: ["id", "username", "email"] },
    ],
  });
  return tasks;
}

async function getClubTask({ tenantId, clubId, taskId }) {
  if (clubId) {
    await ensureClubInTenant(tenantId, clubId);
  }
  return ensureClubTask(tenantId, taskId);
}

async function createClubTask({ tenantId, clubId, actorUserId, payload }) {
  const cid = parsePositiveInt(clubId);
  await ensureClubInTenant(tenantId, cid);
  await ensureClubAdminOrFounder(tenantId, actorUserId, cid);

  if (!payload.title || typeof payload.title !== "string" || !payload.title.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", "title is required.");
  }
  if (payload.priority && !["low", "medium", "high"].includes(payload.priority)) {
    throw new ApiError(400, "VALIDATION_ERROR", "priority must be low, medium, or high.");
  }

  const primaryAssigneeId = payload.assignee_id ? parsePositiveInt(payload.assignee_id) : null;
  const extraIds = parseAssigneeIds(payload.assignee_ids);
  const allAssigneeIds = [...new Set([primaryAssigneeId, ...extraIds].filter(Boolean))];

  if (!allAssigneeIds.length) {
    throw new ApiError(400, "VALIDATION_ERROR", "At least one assignee is required.");
  }

  for (const uid of allAssigneeIds) {
    await ensureClubMember(tenantId, uid);
  }

  await validateActivityIfProvided(tenantId, cid, payload.activity_id);

  return ClubTask.create({
    tenant_id: tenantId,
    club_id: cid,
    activity_id: payload.activity_id ? parsePositiveInt(payload.activity_id) : null,
    title: payload.title.trim(),
    description: payload.description ? payload.description.trim() : null,
    assignee_id: allAssigneeIds[0],
    assignee_ids: allAssigneeIds.join(","),
    created_by: actorUserId,
    due_date: payload.due_date || null,
    priority: payload.priority || "medium",
    status: "pending",
  });
}

async function updateClubTask({ tenantId, clubId, actorUserId, taskId, payload }) {
  const cid = parsePositiveInt(clubId);
  await ensureClubInTenant(tenantId, cid);
  const task = await ensureClubTask(tenantId, taskId);
  if (task.club_id !== cid) {
    throw new ApiError(404, "CLUB_TASK_NOT_FOUND", "Club task not found in this club.");
  }

  const isAssignee = task.assignee_id === actorUserId ||
    parseAssigneeIds(task.assignee_ids).includes(actorUserId);
  const isAdmin = await ClubMember.findOne({
    where: { tenant_id: tenantId, club_id: cid, user_id: actorUserId, role: { [Op.in]: ["founder", "admin"] } },
  });
  const isGlobalAdmin = (await User.findByPk(actorUserId))?.role === "system_admin"
    || (await User.findByPk(actorUserId))?.role === "platform_admin";

  if (!isGlobalAdmin && !isAdmin && !isAssignee) {
    throw new ApiError(403, "CLUB_TASK_PERMISSION_DENIED", "Only admin or assignee can update this task.");
  }

  const updates = {};

  if (payload.title !== undefined) {
    if (!payload.title || typeof payload.title !== "string" || !payload.title.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "title must not be empty.");
    }
    updates.title = payload.title.trim();
  }
  if (payload.description !== undefined) {
    updates.description = payload.description ? payload.description.trim() : null;
  }

  if (payload.assignee_id !== undefined || payload.assignee_ids !== undefined) {
    const primary = payload.assignee_id !== undefined
      ? parsePositiveInt(payload.assignee_id) : task.assignee_id;
    const extra = parseAssigneeIds(
      payload.assignee_ids !== undefined ? payload.assignee_ids : task.assignee_ids
    );
    const allIds = [...new Set([primary, ...extra].filter(Boolean))];
    if (!allIds.length) {
      throw new ApiError(400, "VALIDATION_ERROR", "At least one assignee is required.");
    }
    for (const uid of allIds) {
      await ensureClubMember(tenantId, uid);
    }
    updates.assignee_id = allIds[0];
    updates.assignee_ids = allIds.join(",");
  }

  if (payload.activity_id !== undefined) {
    await validateActivityIfProvided(tenantId, cid, payload.activity_id);
    updates.activity_id = payload.activity_id ? parsePositiveInt(payload.activity_id) : null;
  }
  if (payload.due_date !== undefined) {
    updates.due_date = payload.due_date || null;
  }
  if (payload.priority !== undefined) {
    if (!["low", "medium", "high"].includes(payload.priority)) {
      throw new ApiError(400, "VALIDATION_ERROR", "priority must be low, medium, or high.");
    }
    updates.priority = payload.priority;
  }
  if (payload.status !== undefined) {
    if (!["pending", "in_progress", "completed"].includes(payload.status)) {
      throw new ApiError(400, "VALIDATION_ERROR", "status must be pending, in_progress, or completed.");
    }
    updates.status = payload.status;
  }

  await task.update(updates);
  return ensureClubTask(tenantId, taskId);
}

async function deleteClubTask({ tenantId, clubId, actorUserId, taskId }) {
  const cid = parsePositiveInt(clubId);
  await ensureClubInTenant(tenantId, cid);
  const task = await ensureClubTask(tenantId, taskId);
  if (task.club_id !== cid) {
    throw new ApiError(404, "CLUB_TASK_NOT_FOUND", "Club task not found in this club.");
  }
  await ensureClubAdminOrFounder(tenantId, actorUserId, cid);
  await task.destroy();
}

module.exports = { listClubTasks, listMyTasks, getClubTask, createClubTask, updateClubTask, deleteClubTask };
