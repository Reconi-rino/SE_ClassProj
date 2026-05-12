# Backend

## 说明

后端基于 Express + Sequelize，当前已完成基础骨架、数据库初始化配置与健康检查接口。

## 运行

```bash
npm run dev
```

> 运行前请先确保 MySQL 已启动，并根据 `.env.example` 配置好数据库连接参数。

## 数据库初始化

```bash
# 检查数据库连接
npm run db:check

# 查看 migration 状态
npm run db:migrate:status

# 执行 migration
npm run db:migrate
```

## 健康检查

`GET /api/health`

## 测试（Jest + Supertest）

```bash
# 后端单测 + 集成测试（CI/non-watch）
npm test

# 仅单测
npm run test:unit

# 仅集成测试
npm run test:integration
```

测试默认使用 SQLite 内存数据库，并输出结构化审计日志到 `backend/test-artifacts/audit.log`。

## Activity & Approval API（需认证 + Tenant）

以下接口均在 `/api/business` 下，并要求：

- `Authorization: Bearer <token>`
- `x-tenant-code: <tenant-code>`

### Activity CRUD

- `POST /activities`：创建活动（默认 `draft`）
- `GET /activities`：活动列表（可选 `?status=draft|pending|pending_approval|approved|rejected|completed`）
- `GET /activities/:id`：活动详情
- `PATCH /activities/:id`：更新活动（仅允许安全状态迁移）
- `DELETE /activities/:id`：删除活动（`pending_approval` 不可删）

### Approval Workflow

- `POST /activities/:id/submit-approval`：提交审批（`draft -> pending_approval`）
- `GET /approvals/pending`：待审批列表
- `POST /approvals/:id/decision`：审批决策（`approve` / `reject`，支持 comments）

## Tenant Context 中间件

后端已全局挂载 `resolveTenantContext`（`src/middleware/tenant.middleware.js`）：

- 优先从 `x-tenant-code` 请求头解析租户；
- 若请求头缺失，可选从 JWT 中的 `tenant_code` / `tenantCode` / `tenant.id` 等字段尝试解析；
- 仅当租户存在且 `status=active` 时，才会在 `req.tenant` 附加上下文。

严格业务路由可使用 `requireTenantContext`：

```js
router.get("/some-business-api", requireTenantContext, handler);
```

- 缺少租户上下文：返回 `400`；
- 租户不存在或已停用：返回 `403`。

认证路由（如 `/api/auth/login`、`/api/auth/register`）默认不强制租户校验，避免影响登录注册流程。

## 运行运维建议（当前版本）

- 健康检查分级、追踪 ID 策略、备份恢复流程见：`../docs/OPERABILITY_RUNBOOK.md`
- 发布前硬化检查（安全/性能/回滚）见：`../docs/RELEASE_HARDENING_CHECKLIST.md`
