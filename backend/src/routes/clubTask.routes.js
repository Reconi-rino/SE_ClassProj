const express = require("express");
const { body, param, query } = require("express-validator");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const clubTaskController = require("../controllers/clubTaskController");

const router = express.Router();
router.use(requireAuth, requireTenantContext);

router.get(
  "/my",
  authorize("read", "club_task"),
  clubTaskController.listMyTasks
);

router.get(
  "/",
  [query("club_id").isInt({ min: 1 }).withMessage("club_id is required")],
  authorize("read", "club_task"),
  clubTaskController.listClubTasks
);

router.get(
  "/:id",
  [param("id").isInt({ min: 1 }), query("club_id").optional().isInt({ min: 1 })],
  authorize("read", "club_task"),
  clubTaskController.getClubTask
);

router.post(
  "/",
  [
    body("club_id").isInt({ min: 1 }),
    body("title").isString().trim().isLength({ min: 1, max: 200 }),
    body("description").optional({ nullable: true }).isString().isLength({ max: 5000 }),
    body("assignee_id").optional().isInt({ min: 1 }),
    body("assignee_ids").optional().isString(),
    body("activity_id").optional({ nullable: true }).isInt({ min: 1 }),
    body("due_date").optional({ nullable: true }).isISO8601(),
    body("priority").optional().isIn(["low", "medium", "high"]),
  ],
  authorize("create", "club_task"),
  clubTaskController.createClubTask
);

router.patch(
  "/:id",
  [
    param("id").isInt({ min: 1 }),
    body("club_id").isInt({ min: 1 }),
    body("title").optional().isString().trim().isLength({ min: 1, max: 200 }),
    body("description").optional({ nullable: true }).isString().isLength({ max: 5000 }),
    body("assignee_id").optional().isInt({ min: 1 }),
    body("assignee_ids").optional().isString(),
    body("activity_id").optional({ nullable: true }).isInt({ min: 1 }),
    body("due_date").optional({ nullable: true }).isISO8601(),
    body("priority").optional().isIn(["low", "medium", "high"]),
    body("status").optional().isIn(["pending", "in_progress", "completed"]),
  ],
  authorize("update", "club_task"),
  clubTaskController.updateClubTask
);

router.delete(
  "/:id",
  [param("id").isInt({ min: 1 }), query("club_id").isInt({ min: 1 })],
  authorize("delete", "club_task"),
  clubTaskController.deleteClubTask
);

module.exports = router;
