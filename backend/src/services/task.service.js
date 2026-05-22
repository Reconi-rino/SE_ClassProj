const { Op } = require("sequelize");
const { PersonalTask } = require("../models");
const { ApiError, parsePositiveInt } = require("../utils/common");

async function ensureTask(tenantId, userId, taskId) {
  const id = parsePositiveInt(taskId);
  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "task id must be a positive integer.");
  }
  const task = await PersonalTask.findOne({ where: { id, tenant_id: tenantId, user_id: userId } });
  if (!task) {
    throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
  }
  return task;
}

async function listTasks({ tenantId, userId, status, priority }) {
  const where = { tenant_id: tenantId, user_id: userId };
  if (status && ["pending", "in_progress", "completed"].includes(status)) {
    where.status = status;
  }
  if (priority && ["low", "medium", "high"].includes(priority)) {
    where.priority = priority;
  }
  return PersonalTask.findAll({ where, order: [["created_at", "DESC"]] });
}

async function getTask({ tenantId, userId, taskId }) {
  return ensureTask(tenantId, userId, taskId);
}

async function createTask({ tenantId, userId, payload }) {
  if (!payload.title || typeof payload.title !== "string" || !payload.title.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", "title is required.");
  }
  if (payload.priority && !["low", "medium", "high"].includes(payload.priority)) {
    throw new ApiError(400, "VALIDATION_ERROR", "priority must be low, medium, or high.");
  }
  if (payload.status && !["pending", "in_progress", "completed"].includes(payload.status)) {
    throw new ApiError(400, "VALIDATION_ERROR", "status must be pending, in_progress, or completed.");
  }
  if (payload.due_date && Number.isNaN(new Date(payload.due_date).getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", "due_date must be a valid date.");
  }

  return PersonalTask.create({
    tenant_id: tenantId,
    user_id: userId,
    title: payload.title.trim(),
    description: payload.description ? payload.description.trim() : null,
    due_date: payload.due_date || null,
    priority: payload.priority || "medium",
    status: payload.status || "pending",
  });
}

async function updateTask({ tenantId, userId, taskId, payload }) {
  const task = await ensureTask(tenantId, userId, taskId);

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
  if (payload.due_date !== undefined) {
    if (payload.due_date && Number.isNaN(new Date(payload.due_date).getTime())) {
      throw new ApiError(400, "VALIDATION_ERROR", "due_date must be a valid date.");
    }
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
  return task;
}

async function deleteTask({ tenantId, userId, taskId }) {
  const task = await ensureTask(tenantId, userId, taskId);
  await task.destroy();
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask };
