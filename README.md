# Campus Club Management System

单仓库（Monorepo）项目，包含：

- `backend/`：Express API 服务
- `frontend/`：React 前端（Create React App 规范）
- `docs/`：项目文档

## 快速开始

1. 安装依赖：

```bash
npm install
```

2. 启动后端：

```bash
npm run dev:backend
```

3. 启动前端：

```bash
npm run dev:frontend
```

4. 浏览器访问：

```text
http://localhost:3000
```

点击“检查后端健康状态”，若返回 JSON 则说明前后端协同运行成功（通过前端 `proxy` 转发到后端 `3001`）。

## 数据库命令（根目录可直接执行）

```bash
# 检查数据库连接
npm run db:check

# 查看 migration 状态
npm run db:migrate:status

# 执行 migration
npm run db:migrate
```

> 已兼容 MariaDB：当前使用 `mysql2 + sequelize`，可直接连接 MariaDB（通常无需改代码）。

## 目录结构

```text
backend/
frontend/
docs/
```

详细实施计划见：`docs/IMPLEMENTATION_PLAN.md`

## 租户隔离数据访问（Phase A）

为避免业务处理器误查跨租户数据，后端提供 `backend/src/utils/tenantGuard.js`：

- `requireTenant(req)`：无租户上下文时抛出安全错误（`TENANT_CONTEXT_MISSING`）
- `tenantCreatePayload(req, payload)`：写入时自动注入 `tenant_id`
- `tenantQueryOptions(req, options)`：读/改/删时强制 `where.tenant_id = req.tenant.id`

业务代码示例（已接入 `businessController`）：

```js
const { tenantQueryOptions, tenantCreatePayload } = require("../utils/tenantGuard");

await TenantMembership.findAll(tenantQueryOptions(req, { where: { role: "member" } }));
await TenantMembership.create(tenantCreatePayload(req, { user_id: 123 }));
```

该模式可直接复用于后续 club/activity/finance 模块。

## 统一授权中间件（Phase B）

已新增统一授权层：

- `backend/src/middleware/authorize.middleware.js`
- `backend/src/policies/authorization.policy.js`
- `backend/src/policies/resource.resolver.js`

用法示例（已接入 `business.routes.js`）：

```js
router.patch(
  "/tenant-memberships/:id/role",
  requireAuth,
  requireTenantContext,
  authorize("update_role", "tenant_membership"),
  businessController.updateTenantMembershipRole
);
```

当前策略要点：

- 默认拒绝（deny-by-default）：未命中显式策略直接 `403`
- 区分认证与授权：`requireAuth` 负责 `401`，`authorize` 负责 `403`
- 租户优先：租户资源在缺少 `req.tenant` 时拒绝；跨租户资源访问拒绝
- 兼容现有角色：保留 `system_admin` 高权限；`student` 映射为 `member` 参与策略扩展
- 可以玩原神
## 运维与发布文档

- 运维 Runbook（健康检查分级、Trace/Correlation ID 策略、备份恢复）：`docs/OPERABILITY_RUNBOOK.md`
- 发布硬化清单（安全扫描、性能基线、回滚步骤）：`docs/RELEASE_HARDENING_CHECKLIST.md`
