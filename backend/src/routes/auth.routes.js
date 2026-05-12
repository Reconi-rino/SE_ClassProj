const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// Auth endpoints intentionally do not enforce strict tenant context.
// Tenant can still be resolved globally and read from req.tenant if needed.
router.post(
  "/register",
  [
    body("username").isString().isLength({ min: 3, max: 50 }).withMessage("用户名长度需为 3-50"),
    body("email").isEmail().withMessage("邮箱格式不正确"),
    body("password").isString().isLength({ min: 6, max: 128 }).withMessage("密码长度需为 6-128"),
    body("student_id").isString().matches(/^\d{11}$/).withMessage("学号必须是11位数字"),
    body("role").optional().isIn(["student", "club_admin", "system_admin"]),
    body("tenant_id").optional({ nullable: true }).isInt({ min: 1 }).withMessage("tenant_id must be a positive integer"),
  ],
  authController.register
);

router.post(
  "/login",
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

module.exports = router;
