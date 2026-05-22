const taskService = require("../services/task.service");
const { handleServiceError, handleRequestValidation } = require("../utils/errorResponse");

async function listTasks(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const tasks = await taskService.listTasks({
      tenantId: req.tenant.id,
      userId: req.user.id,
      status: req.query.status,
      priority: req.query.priority,
    });
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getTask(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const task = await taskService.getTask({
      tenantId: req.tenant.id,
      userId: req.user.id,
      taskId: req.params.id,
    });
    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createTask(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const task = await taskService.createTask({
      tenantId: req.tenant.id,
      userId: req.user.id,
      payload: req.body,
    });
    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateTask(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const task = await taskService.updateTask({
      tenantId: req.tenant.id,
      userId: req.user.id,
      taskId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function deleteTask(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    await taskService.deleteTask({
      tenantId: req.tenant.id,
      userId: req.user.id,
      taskId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Task deleted." });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask };
