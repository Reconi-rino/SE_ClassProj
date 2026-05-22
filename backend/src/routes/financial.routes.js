const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const financialController = require("../controllers/financialController");

const router = express.Router();

// 财务公示 — 公开，仅需租户上下文
router.get("/reports/monthly", requireTenantContext, financialController.getFinancialMonthlySummary);

// 需要认证和授权
router.get("/", requireAuth, requireTenantContext, authorize("read", "financial_record"), financialController.listFinancialRecords);
router.get("/aggregates", requireAuth, requireTenantContext, authorize("read", "financial_record"), financialController.getFinancialAggregates);
router.get("/reports/yearly", requireAuth, requireTenantContext, authorize("read", "financial_record"), financialController.getFinancialYearlySummary);
router.get("/:id", requireAuth, requireTenantContext, authorize("read", "financial_record"), financialController.getFinancialRecord);

router.post("/", requireAuth, requireTenantContext, authorize("create", "financial_record"), financialController.createFinancialRecord);
router.put("/:id", requireAuth, requireTenantContext, authorize("update", "financial_record"), financialController.updateFinancialRecord);
router.delete("/:id", requireAuth, requireTenantContext, authorize("delete", "financial_record"), financialController.deleteFinancialRecord);

module.exports = router;
