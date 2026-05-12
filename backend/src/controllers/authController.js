const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { User, Tenant, TenantMembership } = require("../models");
const sequelize = require("../config/database");
const { logAuditEvent } = require("../utils/auditLogger");

const SALT_ROUNDS = 10;
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || "admin@ccms.local";
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || "system_admin";
const DEFAULT_ADMIN_STUDENT_ID = process.env.DEFAULT_ADMIN_STUDENT_ID || "00000000000";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123456";

function buildTokenPayload(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    forcePasswordReset: Boolean(user.force_password_reset),
  };
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  });
}

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { username, email, password, student_id, role, tenant_id } = req.body;

  if (tenant_id) {
    const tenantExists = await Tenant.findOne({ where: { id: tenant_id, status: "active" } });
    if (!tenantExists) {
      return res.status(400).json({
        success: false,
        message: "指定的学校(租户)不存在或未激活",
      });
    }
  }

  const existingUser = await User.findOne({
    where: { email },
  });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email already registered",
    });
  }

  const existingUsername = await User.findOne({
    where: { username },
  });
  if (existingUsername) {
    return res.status(409).json({
      success: false,
      message: "Username already taken",
    });
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const transaction = await sequelize.transaction();
  try {
    const user = await User.create(
      {
        username,
        email,
        password_hash,
        student_id,
        role: role || "student",
        force_password_reset: false,
      },
      { transaction }
    );

    if (tenant_id) {
      await TenantMembership.create(
        {
          tenant_id: tenant_id,
          user_id: user.id,
          role: "member",
        },
        { transaction }
      );
    }

    await transaction.commit();

    const token = signToken(buildTokenPayload(user));

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      data: {
        user: buildTokenPayload(user),
        token,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: "注册失败，发生内部错误",
    });
  }
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });

  if (!user) {
    logAuditEvent({
      req,
      action: "auth.login",
      outcome: "failure",
      actor: {
        id: null,
        role: null,
        email,
      },
      metadata: {
        reason: "user_not_found",
      },
    });
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    logAuditEvent({
      req,
      action: "auth.login",
      outcome: "failure",
      actor: {
        id: user.id,
        role: user.role,
        email: user.email,
      },
      metadata: {
        reason: "password_mismatch",
      },
    });
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const token = signToken(buildTokenPayload(user));
  logAuditEvent({
    req,
    action: "auth.login",
    outcome: "success",
    actor: {
      id: user.id,
      role: user.role,
      email: user.email,
    },
  });
  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: buildTokenPayload(user),
      token,
    },
  });
}

async function resetPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { newPassword } = req.body;
  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  if (user.role === "system_admin") {
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasSpecial) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [
          {
            path: "newPassword",
            msg: "管理员新密码必须包含大写字母、小写字母和特殊符号",
          },
        ],
      });
    }
  }

  user.password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.force_password_reset = false;
  await user.save();

  const token = signToken(buildTokenPayload(user));
  logAuditEvent({
    req,
    action: "auth.reset_password",
    outcome: "success",
    actor: {
      id: user.id,
      role: user.role,
      email: user.email,
    },
    target: {
      type: "user",
      id: user.id,
    },
  });
  return res.status(200).json({
    success: true,
    message: "Password reset successful",
    data: {
      user: buildTokenPayload(user),
      token,
    },
  });
}

async function ensureDefaultAdmin() {
  const existing = await User.findOne({ where: { email: DEFAULT_ADMIN_EMAIL } });
  if (existing) {
    return;
  }

  const password_hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
  await User.create({
    username: DEFAULT_ADMIN_USERNAME,
    email: DEFAULT_ADMIN_EMAIL,
    student_id: DEFAULT_ADMIN_STUDENT_ID,
    password_hash,
    role: "system_admin",
    force_password_reset: true,
  });

  console.log(`Default admin created: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
}

function me(req, res) {
  return res.status(200).json({
    success: true,
    data: req.user,
  });
}

module.exports = {
  register,
  login,
  resetPassword,
  me,
  ensureDefaultAdmin,
};
