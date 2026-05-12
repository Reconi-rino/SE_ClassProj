const { validationResult } = require("express-validator");
const { UniqueConstraintError, ValidationError } = require("sequelize");
const clubService = require("../services/club.service");

function toErrorResponse(res, status, code, message, details) {
  return res.status(status).json({
    success: false,
    code,
    message,
    ...(details ? { details } : {}),
  });
}

function handleServiceError(error, res, next) {
  if (error && error.name === "ApiError") {
    return toErrorResponse(res, error.status || 400, error.code || "API_ERROR", error.message, error.details);
  }

  if (error instanceof UniqueConstraintError) {
    return toErrorResponse(res, 409, "CONFLICT", "Resource already exists.", error.errors);
  }

  if (error instanceof ValidationError) {
    return toErrorResponse(res, 400, "VALIDATION_ERROR", "Validation failed.", error.errors);
  }

  return next(error);
}

function handleRequestValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    toErrorResponse(res, 400, "VALIDATION_ERROR", "Validation failed.", errors.array());
    return false;
  }
  return true;
}

async function listClubs(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    const clubs = await clubService.listClubs({
      tenantId: req.tenant.id,
      status: req.query.status,
      keyword: req.query.q,
    });

    return res.status(200).json({
      success: true,
      data: clubs,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function getClub(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    const club = await clubService.getClub({
      tenantId: req.tenant.id,
      clubId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      data: club,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function createClub(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    const club = await clubService.createClub({
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      payload: req.body,
    });

    return res.status(201).json({
      success: true,
      data: club,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateClub(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    const club = await clubService.updateClub({
      tenantId: req.tenant.id,
      clubId: req.params.id,
      payload: req.body,
    });

    return res.status(200).json({
      success: true,
      data: club,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function deleteClub(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    await clubService.deleteClub({
      tenantId: req.tenant.id,
      clubId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "Club deleted.",
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function listClubMembers(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    const result = await clubService.listClubMembers({
      tenantId: req.tenant.id,
      clubId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function joinClub(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    const targetUserId = req.body.user_id ? Number(req.body.user_id) : req.user.id;
    const membership = await clubService.joinClub({
      tenantId: req.tenant.id,
      clubId: req.params.id,
      userId: targetUserId,
    });

    if (req.body.role && req.body.role !== "member") {
      await clubService.updateClubMemberRole({
        tenantId: req.tenant.id,
        clubId: req.params.id,
        memberId: membership.id,
        role: req.body.role,
      });
      membership.role = req.body.role;
    }

    return res.status(201).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function leaveClub(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    await clubService.leaveClub({
      tenantId: req.tenant.id,
      clubId: req.params.id,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Left club successfully.",
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function updateClubMemberRole(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    const membership = await clubService.updateClubMemberRole({
      tenantId: req.tenant.id,
      clubId: req.params.id,
      memberId: req.params.memberId,
      role: req.body.role,
    });

    return res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

async function removeClubMember(req, res, next) {
  if (!handleRequestValidation(req, res)) {
    return;
  }

  try {
    await clubService.removeClubMember({
      tenantId: req.tenant.id,
      clubId: req.params.id,
      memberId: req.params.memberId,
    });

    return res.status(200).json({
      success: true,
      message: "Club member removed.",
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

module.exports = {
  listClubs,
  getClub,
  createClub,
  updateClub,
  deleteClub,
  listClubMembers,
  joinClub,
  leaveClub,
  updateClubMemberRole,
  removeClubMember,
};
