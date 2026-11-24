const express = require("express");
const { body, param, query } = require("express-validator");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const businessController = require("../controllers/businessController");
const activityController = require("../controllers/activityController");
const registrations = require("../controllers/activityRegistrationController");

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

const activityStatusValues = ["draft", "pending_approval", "pending", "approved", "rejected", "cancelled", "completed"];
const dateFilter = (name) =>
  query(name).optional().isString().bail().matches(/^\d{4}-\d{2}-\d{2}$/).bail().isISO8601({ strict: true });
const registrationCapacity = () =>
  body("registration_capacity")
    .optional({ nullable: true })
    .isInt({ min: 1, max: 10000 })
    .withMessage("registration_capacity must be between 1 and 10000")
    .toInt();

const ownRegistration = [requireAuth, requireTenantContext, authorize("self", "activity_registration")];
const registrationActivityId = () => param("id").isInt({ min: 1, max: 4294967295 });

router.get("/my-registrations", ownRegistration, registrations.listMyRegistrations);
router.put("/activities/:id/registration", ownRegistration, registrationActivityId(), registrations.register);
router.delete("/activities/:id/registration", ownRegistration, registrationActivityId(), registrations.cancel);
router.patch("/activities/:id/registration/cancellation-read", ownRegistration, registrationActivityId(), registrations.readCancellation);
router.post(
  "/activities/:id/cancel",
  requireAuth, requireTenantContext, registrationActivityId(),
  authorize("update", "activity"),
  body("reason").isString().bail().trim().isLength({ min: 1, max: 500 }).withMessage("请填写取消原因，最多 500 字。"),
  registrations.cancelActivity
);
router.put(
  "/activities/:id/registrations/:userId/attendance",
  requireAuth, requireTenantContext, registrationActivityId(),
  param("userId").isInt({ min: 1, max: 4294967295 }),
  authorize("read_registrations", "activity"),
  body("checked_in").custom((value) => typeof value === "boolean").withMessage("checked_in 必须是布尔值。"),
  registrations.setAttendance
);
router.get(
  "/activities/:id/registrations",
  requireAuth,
  requireTenantContext,
  registrationActivityId(),
  authorize("read_registrations", "activity"),
  registrations.listRoster
);

router.post(
  "/activities",
  requireAuth,
  requireTenantContext,
  authorize("create", "activity"),
  [
    registrationCapacity(),
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
      .withMessage("无效的活动状态。"),
    query("clubId").optional().isString().bail().isInt({ min: 1, max: 4294967295 }).toInt(),
    dateFilter("startDate"),
    dateFilter("endDate").custom((date, { req }) => {
      if (req.query.startDate && date < req.query.startDate) throw new Error("结束日期不能早于开始日期。");
      return true;
    }),
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
    registrationCapacity(),
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
    body("approver_id").optional().isInt({ min: 1 }).withMessage("approver_id must be a positive integer"),
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
