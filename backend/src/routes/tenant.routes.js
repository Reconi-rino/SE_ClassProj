const express = require("express");
const { body, param } = require("express-validator");
const tenantController = require("../controllers/tenantController");
const { requireAuth } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");

const router = express.Router();

// 公开：注册页获取可用租户列表
router.get("/", tenantController.listActiveTenants);

// 管理：创建/编辑/删除租户（仅 system_admin）
router.post(
  "/",
  requireAuth,
  authorize("create", "tenant"),
  [body("name").isString().trim().isLength({ min: 1, max: 100 }),
   body("code").isString().trim().isLength({ min: 2, max: 50 })],
  tenantController.createTenant
);

router.patch(
  "/:id",
  requireAuth,
  authorize("update", "tenant"),
  [param("id").isInt({ min: 1 }),
   body("name").optional().isString().trim().isLength({ min: 1, max: 100 }),
   body("status").optional().isIn(["active", "inactive", "archived"])],
  tenantController.updateTenant
);

router.delete(
  "/:id",
  requireAuth,
  authorize("delete", "tenant"),
  [param("id").isInt({ min: 1 })],
  tenantController.deleteTenant
);

module.exports = router;
