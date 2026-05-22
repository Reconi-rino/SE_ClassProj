const { UniqueConstraintError, ValidationError } = require("sequelize");
const { validationResult } = require("express-validator");

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

module.exports = {
  toTenantSafeError,
  validationError,
  toErrorResponse,
  handleServiceError,
  handleRequestValidation,
};
