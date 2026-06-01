const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth.middleware");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 10,                    // 最多 10 次尝试
  message: { success: false, message: "登录尝试过多，请 15 分钟后再试。" },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 5,                     // 最多 5 次注册
  message: { success: false, message: "注册请求过多，请稍后再试。" },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Auth endpoints intentionally do not enforce strict tenant context.
// Tenant can still be resolved globally and read from req.tenant if needed.
router.post(
  "/register",
  registerLimiter,
  [
    body("username").isString().isLength({ min: 3, max: 50 }).withMessage("用户名长度需为 3-50"),
    body("email").isEmail().withMessage("邮箱格式不正确"),
    body("password").isString().isLength({ min: 6, max: 128 }).withMessage("密码长度需为 6-128"),
    body("student_id").isString().matches(/^\d{11}$/).withMessage("学号必须是11位数字"),
    body("role").optional().isIn(["student"]),
    body("tenant_id").optional({ nullable: true }).isInt({ min: 1 }).withMessage("tenant_id must be a positive integer"),
  ],
  authController.register
);

router.post(
  "/login",
  loginLimiter,
  [
    body("email").isEmail().withMessage("邮箱格式不正确"),
    body("password").isString().isLength({ min: 6, max: 128 }).withMessage("密码长度需为 6-128"),
  ],
  authController.login
);

router.post(
  "/reset-password",
  requireAuth,
  [
    body("newPassword")
      .exists({ checkFalsy: true })
      .withMessage("请输入新密码")
      .bail()
      .isString()
      .withMessage("新密码格式不正确")
      .bail()
      .isLength({ min: 6, max: 128 })
      .withMessage("新密码长度需为 6-128"),
    body("confirmNewPassword")
      .exists({ checkFalsy: true })
      .withMessage("请再次输入新密码")
      .bail()
      .isString()
      .withMessage("确认密码格式不正确")
      .bail()
      .isLength({ min: 6, max: 128 })
      .withMessage("确认密码长度需为 6-128")
      .bail()
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage("两次输入的新密码不一致"),
  ],
  authController.resetPassword
);

router.get("/me", requireAuth, authController.me);

router.post("/avatar", requireAuth, authController.uploadAvatar);

module.exports = router;
