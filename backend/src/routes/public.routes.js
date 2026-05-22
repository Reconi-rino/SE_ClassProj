const express = require("express");
const { resolveTenantContext } = require("../middleware/tenant.middleware");
const publicController = require("../controllers/publicController");

const router = express.Router();
router.use(resolveTenantContext);

router.get("/clubs", publicController.listPublicClubs);
router.get("/clubs/:id", publicController.getPublicClub);

module.exports = router;
