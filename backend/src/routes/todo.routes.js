const express = require("express");
const { body, param, query } = require("express-validator");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const taskController = require("../controllers/taskController");

const router = express.Router();
router.use(requireAuth, requireTenantContext);

router.get("/", authorize("read", "personal_task"), taskController.listTasks);
router.get("/:id", [param("id").isInt({ min: 1 })], authorize("read", "personal_task"), taskController.getTask);

router.post(
  "/",
  [
    body("title").isString().trim().isLength({ min: 1, max: 200 }),
    body("description").optional({ nullable: true }).isString().isLength({ max: 5000 }),
    body("due_date").optional({ nullable: true }).isISO8601(),
    body("priority").optional().isIn(["low", "medium", "high"]),
  ],
  authorize("create", "personal_task"),
  taskController.createTask
);

router.patch(
  "/:id",
  [
    param("id").isInt({ min: 1 }),
    body("title").optional().isString().trim().isLength({ min: 1, max: 200 }),
    body("description").optional({ nullable: true }).isString().isLength({ max: 5000 }),
    body("due_date").optional({ nullable: true }).isISO8601(),
    body("priority").optional().isIn(["low", "medium", "high"]),
    body("status").optional().isIn(["pending", "in_progress", "completed"]),
  ],
  authorize("update", "personal_task"),
  taskController.updateTask
);

router.delete("/:id", [param("id").isInt({ min: 1 })], authorize("delete", "personal_task"), taskController.deleteTask);

const attachmentController = require("../controllers/attachmentController");

// Set taskType middleware for todo attachments
function setTaskType(type) {
  return (req, res, next) => { req.params.taskType = type; next(); };
}
router.get("/:id/attachments", setTaskType("personal"), attachmentController.listAttachments);
router.post("/:id/attachments", setTaskType("personal"), attachmentController.uploadFile);
router.get("/:id/attachments/download", setTaskType("personal"), attachmentController.downloadAttachments);

module.exports = router;
