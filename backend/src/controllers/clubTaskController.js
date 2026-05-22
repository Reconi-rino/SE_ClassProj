const clubTaskService = require("../services/clubTask.service");
const { handleServiceError, handleRequestValidation } = require("../utils/errorResponse");

async function listClubTasks(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const tasks = await clubTaskService.listClubTasks({
      tenantId: req.tenant.id,
      clubId: req.query.club_id,
      actorUserId: req.user.id,
      assigneeId: req.query.assignee_id,
      status: req.query.status,
    });
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getClubTask(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const task = await clubTaskService.getClubTask({
      tenantId: req.tenant.id,
      clubId: req.query.club_id,
      taskId: req.params.id,
    });
    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createClubTask(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const task = await clubTaskService.createClubTask({
      tenantId: req.tenant.id,
      clubId: req.body.club_id,
      actorUserId: req.user.id,
      payload: req.body,
    });
    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateClubTask(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const task = await clubTaskService.updateClubTask({
      tenantId: req.tenant.id,
      clubId: req.body.club_id,
      actorUserId: req.user.id,
      taskId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function deleteClubTask(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    await clubTaskService.deleteClubTask({
      tenantId: req.tenant.id,
      clubId: req.query.club_id,
      actorUserId: req.user.id,
      taskId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Club task deleted." });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listMyTasks(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const tasks = await clubTaskService.listMyTasks({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
    });
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

module.exports = { listClubTasks, listMyTasks, getClubTask, createClubTask, updateClubTask, deleteClubTask };
