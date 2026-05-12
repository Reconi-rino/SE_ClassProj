const express = require("express");
const tenantController = require("../controllers/tenantController");

const router = express.Router();

router.get("/", tenantController.listActiveTenants);

module.exports = router;
