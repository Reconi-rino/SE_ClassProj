const express = require("express");
const { body, param, query } = require("express-validator");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const businessController = require("../controllers/businessController");
const activityController = require("../controllers/activityController");

const router = express.Router();

router.get("/tenant-context", requireTenantContext, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      tenant: req.tenant,
    },
  });
});

router.get(
  "/tenant-memberships",
  requireAuth,
  requireTenantContext,
  authorize("read", "tenant_membership"),
  businessController.listTenantMemberships
);
router.post(
  "/tenant-memberships",
  requireAuth,
  requireTenantContext,
  authorize("create", "tenant_membership"),
  businessController.createTenantMembership
);
router.patch(
  "/tenant-memberships/:id/role",
  requireAuth,
  requireTenantContext,
  authorize("update_role", "tenant_membership"),
  businessController.updateTenantMembershipRole
);
router.delete(
  "/tenant-memberships/:id",
  requireAuth,
  requireTenantContext,
  authorize("delete", "tenant_membership"),
  businessController.deleteTenantMembership
);

const activityStatusValues = ["draft", "pending_approval", "pending", "approved", "rejected", "completed"];

router.post(
  "/activities",
  requireAuth,
  requireTenantContext,
  authorize("create", "activity"),
  [
    body("club_id").isInt({ min: 1 }).withMessage("club_id must be a positive integer"),
    body("title")
      .isString()
      .isLength({ min: 2, max: 150 })
      .withMessage("title length must be 2-150 characters"),
    body("description")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 5000 })
      .withMessage("description must be a string with max 5000 chars"),
    body("start_time").isISO8601().withMessage("start_time must be a valid ISO datetime"),
    body("end_time")
      .optional({ nullable: true })
      .isISO8601()
      .withMessage("end_time must be a valid ISO datetime"),
    body("end_time").optional({ nullable: true }).custom((value, { req }) => {
      if (!value) {
        return true;
      }
      const start = Date.parse(req.body.start_time);
      const end = Date.parse(value);
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
        throw new Error("end_time must be after start_time");
      }
      return true;
    }),
    body("location")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 255 })
      .withMessage("location must be a string with max 255 chars"),
  ],
  activityController.createActivity
);

router.get(
  "/activities",
  requireAuth,
  requireTenantContext,
  authorize("read", "activity"),
  [
    query("status")
      .optional()
      .isIn(activityStatusValues)
      .withMessage("status must be one of draft,pending,pending_approval,approved,rejected,completed"),
  ],
  activityController.listActivities
);

router.get(
  "/activities/:id",
  requireAuth,
  requireTenantContext,
  authorize("read", "activity"),
  [param("id").isInt({ min: 1 }).withMessage("id must be a positive integer")],
  activityController.getActivityById
);

router.patch(
  "/activities/:id",
  requireAuth,
  requireTenantContext,
  authorize("update", "activity"),
  [
    param("id").isInt({ min: 1 }).withMessage("id must be a positive integer"),
    body("title")
      .optional()
      .isString()
      .isLength({ min: 2, max: 150 })
      .withMessage("title length must be 2-150 characters"),
    body("description")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 5000 })
      .withMessage("description must be a string with max 5000 chars"),
    body("start_time").optional().isISO8601().withMessage("start_time must be a valid ISO datetime"),
    body("end_time")
      .optional({ nullable: true })
      .isISO8601()
      .withMessage("end_time must be a valid ISO datetime"),
    body("end_time").optional({ nullable: true }).custom((value, { req }) => {
      if (!value) {
        return true;
      }
      const startRaw = req.body.start_time;
      if (!startRaw) {
        return true;
      }
      const start = Date.parse(startRaw);
      const end = Date.parse(value);
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
        throw new Error("end_time must be after start_time");
      }
      return true;
    }),
    body("location")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 255 })
      .withMessage("location must be a string with max 255 chars"),
    body("status")
      .optional()
      .isIn(["draft", "completed"])
      .withMessage("status patch only supports draft or completed"),
  ],
  activityController.updateActivity
);

router.delete(
  "/activities/:id",
  requireAuth,
  requireTenantContext,
  authorize("delete", "activity"),
  [param("id").isInt({ min: 1 }).withMessage("id must be a positive integer")],
  activityController.deleteActivity
);

router.post(
  "/activities/:id/submit-approval",
  requireAuth,
  requireTenantContext,
  authorize("submit_approval", "activity"),
  [
    param("id").isInt({ min: 1 }).withMessage("id must be a positive integer"),
    body("approver_id").isInt({ min: 1 }).withMessage("approver_id must be a positive integer"),
    body("comments")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 5000 })
      .withMessage("comments must be a string with max 5000 chars"),
  ],
  activityController.submitForApproval
);

router.get(
  "/approvals/pending",
  requireAuth,
  requireTenantContext,
  authorize("read_pending", "approval"),
  activityController.listPendingApprovals
);

router.post(
  "/approvals/:id/decision",
  requireAuth,
  requireTenantContext,
  authorize("decide", "approval"),
  [
    param("id").isInt({ min: 1 }).withMessage("id must be a positive integer"),
    body("decision").isIn(["approve", "reject"]).withMessage("decision must be approve or reject"),
    body("comments")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 5000 })
      .withMessage("comments must be a string with max 5000 chars"),
  ],
  activityController.decideApproval
);

module.exports = router;
