const { Op } = require("sequelize");
const { ClubTask, Club, ClubMember, TenantMembership, User, Activity } = require("../models");
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

async function canManageCampus(tenantId, userId) {
  const user = await User.findByPk(userId);
  if (["system_admin", "platform_admin"].includes(user?.role)) return true;
  const tenantMember = await TenantMembership.findOne({ where: { tenant_id: tenantId, user_id: userId } });
  return tenantMember?.role === "tenant_admin";
}

async function clubAccess(tenantId, userId, clubId) {
  if (await canManageCampus(tenantId, userId)) return { canManage: true, canRead: true };
  const member = await ClubMember.findOne({ where: { tenant_id: tenantId, club_id: clubId, user_id: userId } });
  const canManage = ["founder", "admin"].includes(member?.role);
  return { canManage, canRead: canManage || Boolean(member) };
}

async function ensureClubAdminOrFounder(tenantId, userId, clubId) {
  if (!(await clubAccess(tenantId, userId, clubId)).canManage) {
    throw new ApiError(403, "CLUB_TASK_PERMISSION_DENIED", "Only club founder or admin can manage tasks.");
  }
}

async function ensureClubMember(tenantId, clubId, userId) {
  const isMember = await ClubMember.findOne({
    where: { tenant_id: tenantId, club_id: clubId, user_id: userId },
  });
  if (!isMember) {
    throw new ApiError(400, "ASSIGNEE_NOT_IN_CLUB", "只能将任务分配给本社团成员。");
  }
}

function parseAssigneeIds(value) {
  if (!value) return [];
  if (typeof value === "string") {
    return value.split(",").map((s) => parsePositiveInt(s.trim())).filter(Boolean);
  }
  return [];
}

function assignedTo(task, userId) {
  return task.assignee_id === userId || parseAssigneeIds(task.assignee_ids).includes(userId);
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
  const club = await ensureClubInTenant(tenantId, clubId);
  const access = await clubAccess(tenantId, actorUserId, club.id);
  if (!access.canRead) throw new ApiError(403, "CLUB_TASK_PERMISSION_DENIED", "只能查看所属社团的任务。");
  const where = { tenant_id: tenantId, club_id: club.id };
  if (assigneeId) Object.assign(where, assigneeWhere(parsePositiveInt(assigneeId)));
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

function assigneeWhere(userId) {
  return {
    [Op.or]: [
      { assignee_id: userId },
      { assignee_ids: String(userId) },
      { assignee_ids: { [Op.like]: `${userId},%` } },
      { assignee_ids: { [Op.like]: `%,${userId},%` } },
      { assignee_ids: { [Op.like]: `%,${userId}` } },
    ],
  };
}

async function listMyTasks({ tenantId, actorUserId }) {
  const where = { tenant_id: tenantId, ...assigneeWhere(actorUserId) };
  if (!(await canManageCampus(tenantId, actorUserId))) {
    const memberships = await ClubMember.findAll({
      where: { tenant_id: tenantId, user_id: actorUserId },
      attributes: ["club_id"],
    });
    where.club_id = memberships.map(({ club_id }) => club_id);
  }
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

async function getClubTaskAccess({ tenantId, clubId, taskId, actorUserId }) {
  const task = await ensureClubTask(tenantId, taskId);
  if (clubId && parsePositiveInt(clubId) !== task.club_id) {
    throw new ApiError(404, "CLUB_TASK_NOT_FOUND", "Club task not found in this club.");
  }
  const access = await clubAccess(tenantId, actorUserId, task.club_id);
  const isAssignee = assignedTo(task, actorUserId);
  if (!access.canRead) {
    throw new ApiError(403, "CLUB_TASK_PERMISSION_DENIED", "无权访问此社团任务。");
  }
  return { task, canManage: access.canManage, isAssignee };
}

async function getClubTask(context) {
  const { task } = await getClubTaskAccess(context);
  return task;
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
    await ensureClubMember(tenantId, cid, uid);
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

  const { canManage, canRead } = await clubAccess(tenantId, actorUserId, cid);
  if (!canRead || (!canManage && (!assignedTo(task, actorUserId) ||
      Object.keys(payload).some((field) => field !== "club_id" && field !== "status")))) {
    throw new ApiError(403, "CLUB_TASK_PERMISSION_DENIED", "任务负责人只能更新任务状态。");
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
      await ensureClubMember(tenantId, cid, uid);
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

module.exports = { listClubTasks, listMyTasks, getClubTask, getClubTaskAccess, createClubTask, updateClubTask, deleteClubTask };
