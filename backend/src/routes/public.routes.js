const express = require("express");
const { query } = require("express-validator");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const publicController = require("../controllers/publicController");
const registrations = require("../controllers/activityRegistrationController");

const router = express.Router();
router.get("/clubs", publicController.listPublicClubs);
router.get("/clubs/:id", publicController.getPublicClub);
router.get(
  "/activities",
  requireTenantContext,
  query("club_id").optional().isInt({ min: 1, max: 4294967295 }).toInt(),
  registrations.listOpenActivities
);

module.exports = router;
