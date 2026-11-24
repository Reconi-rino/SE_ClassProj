const express = require("express");
const { body, matchedData, param, query } = require("express-validator");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const { handleRequestValidation, handleServiceError } = require("../utils/errorResponse");
const { logAuditEvent } = require("../utils/auditLogger");
const reimbursement = require("../services/reimbursement.service");

const router = express.Router();
const statuses = ["pending", "returned", "approved", "booked", "withdrawn"];
const actions = ["resubmit", "withdraw", "review", "book"];
router.use(requireAuth, requireTenantContext);

const textField = (field, max, message) => body(field).isString().bail().trim().isLength({ min: 1, max }).withMessage(message);
const application = [
  body("amount").custom((value) => {
    if (!["string", "number"].includes(typeof value) ||
        !/^\d{1,10}(\.\d{1,2})?$/.test(String(value)) || Number(value) <= 0) {
      throw new Error("请输入大于零、最多两位小数的金额。");
    }
    return true;
  }),
  textField("category", 100, "请填写费用分类（最多 100 字）。"),
  textField("purpose", 500, "请填写报销用途（最多 500 字）。"),
  textField("receipt_reference", 120, "请填写发票号或收据编号（最多 120 字）。"),
  body("expense_date").isString().bail().matches(/^\d{4}-\d{2}-\d{2}$/).bail()
    .isISO8601({ strict: true }).withMessage("请输入有效的支出日期。"),
];

function context(req) {
  const { actorGlobalRole, actorTenantRole } = req.authorization.context;
  return {
    tenantId: req.tenant.id,
    actorId: req.user.id,
    id: Number(req.params.id),
    canReview: actorTenantRole === "tenant_admin" || ["system_admin", "platform_admin"].includes(actorGlobalRole),
    input: matchedData(req, { locations: ["body"] }),
  };
}

function mutation(action) {
  return async (req, res, next) => {
    if (!handleRequestValidation(req, res)) return;
    try {
      const result = action === "create" ? await reimbursement.create(context(req)) :
        await reimbursement.change(context(req), action);
      if (result.changed) {
        logAuditEvent({
          req,
          action: `reimbursement.${action}`,
          target: { type: "reimbursement", id: result.request.id },
          metadata: { status: result.request.status, revision: result.request.revision },
        });
      }
      const data = result.request.toJSON();
      delete data.request_key;
      return res.status(action === "create" && result.changed ? 201 : 200).json({ success: true, data });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  };
}

router.get("/", authorize("access", "reimbursement"),
  query("scope").optional().isIn(["mine", "review"]),
  query("status").optional().isIn(statuses),
  async (req, res, next) => {
    if (!handleRequestValidation(req, res)) return;
    try {
      const data = await reimbursement.list({ ...context(req), scope: req.query.scope, status: req.query.status });
      return res.json({ success: true, data });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  }
);

router.post("/", authorize("access", "reimbursement"),
  body("club_id").isInt({ min: 1, max: 4294967295 }).toInt(),
  body("request_key").isString().matches(/^[a-f0-9]{32}$/),
  application, mutation("create")
);

const validators = {
  resubmit: application,
  withdraw: [],
  review: [
    body("decision").isIn(["approve", "return"]),
    body("review_note").if((_, { req }) => req.body.decision === "return" || req.body.review_note !== undefined)
      .isString().withMessage("退回时请填写原因。").bail().trim().isLength({ max: 500 })
      .withMessage("审核意见最多 500 字。")
      .custom((value, { req }) => req.body.decision !== "return" || value.length > 0)
      .withMessage("退回时请填写原因（最多 500 字）。"),
  ],
  book: [textField("payment_reference", 120, "请填写付款凭证编号（最多 120 字）。")],
};

for (const action of actions) {
  const permission = action === "review" || action === "book" ? "review" : "access";
  router.post(`/:id/${action}`, authorize(permission, "reimbursement"),
    param("id").isInt({ min: 1, max: 4294967295 }),
    body("revision").isInt({ min: 1, max: 4294967295 }).toInt(),
    validators[action], mutation(action)
  );
}

module.exports = router;
