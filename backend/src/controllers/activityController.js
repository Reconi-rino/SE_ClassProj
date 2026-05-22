const activityService = require("../services/activity.service");
const { handleServiceError, handleRequestValidation } = require("../utils/errorResponse");

async function createActivity(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const activity = await activityService.createActivity({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      payload: req.body,
    });
    return res.status(201).json({ success: true, data: activity });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listActivities(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const activities = await activityService.listActivities({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      status: req.query.status,
      userRole: req.user.role,
    });
    return res.status(200).json({ success: true, data: activities });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getActivityById(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const activity = await activityService.getActivityById({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      activityId: req.params.id,
    });
    return res.status(200).json({ success: true, data: activity });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateActivity(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const activity = await activityService.updateActivity({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      activityId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, data: activity });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function deleteActivity(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    await activityService.deleteActivity({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      activityId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Activity deleted." });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function submitForApproval(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const result = await activityService.submitForApproval({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      activityId: req.params.id,
      approverId: req.body.approver_id,
      comments: req.body.comments,
    });
    return res.status(200).json({ success: true, message: "Activity submitted for approval.", data: result });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listPendingApprovals(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const approvals = await activityService.listPendingApprovals({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      status: req.query.status,
      userRole: req.user.role,
    });
    return res.status(200).json({ success: true, data: approvals });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function decideApproval(req, res, next) {
  if (!handleRequestValidation(req, res)) return;
  try {
    const result = await activityService.decideApproval({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      approvalId: req.params.id,
      decision: req.body.decision,
      comments: req.body.comments,
      userRole: req.user.role,
    });
    return res.status(200).json({
      success: true,
      message: result.approval.status === "approved" ? "Activity approved." : "Activity rejected.",
      data: result,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
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
