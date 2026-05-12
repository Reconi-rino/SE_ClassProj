const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const financialController = require("../controllers/financialController");

const router = express.Router();

router.get("/", requireTenantContext, financialController.listFinancialRecords);
router.get("/aggregates", requireTenantContext, financialController.getFinancialAggregates);
router.get("/reports/monthly", requireTenantContext, financialController.getFinancialMonthlySummary);
router.get("/reports/yearly", requireTenantContext, financialController.getFinancialYearlySummary);
router.get("/:id", requireTenantContext, financialController.getFinancialRecord);

router.post(
  "/",
  requireAuth,
  requireTenantContext,
  authorize("create", "financial_record"),
  financialController.createFinancialRecord
);
router.put(
  "/:id",
  requireAuth,
  requireTenantContext,
  authorize("update", "financial_record"),
  financialController.updateFinancialRecord
);
router.delete(
  "/:id",
  requireAuth,
  requireTenantContext,
  authorize("delete", "financial_record"),
  financialController.deleteFinancialRecord
);

module.exports = router;
