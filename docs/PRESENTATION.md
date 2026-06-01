# CCMS 软件工程实践汇报

> **给 LLM 的说明**：本文件以软件工程概念为骨架。每个论点都有代码注释或文件路径支撑。你可以直接提取内容生成演示文稿——所有数据、代码、设计决策均来自实际项目，无需编造。

---

## 1. 项目定位

**系统类型**：多租户 SaaS Web 应用（校园社团管理）
**技术栈**：Express + React (CRA) + MariaDB/MySQL + Sequelize ORM
**团队模式**：多人联合作战，每人配备独立 AI Agent，通过 Claude Code CLI 协同

**软件工程焦点**：
- 分层架构 (Layered Architecture) 的落地与演化
- 高内聚低耦合 (High Cohesion, Low Coupling) 的量化改进
- 防御性编程 (Defensive Programming) 与纵深防御 (Defense in Depth)
- AI 辅助开发的质量控制 (Harness Engineering)
- 技术债务识别与偿还策略

<!-- ANNOTATION: 系统规模量化
截至 Milestone 2:
- 11 个 Sequelize 模型, 14 个迁移
- 5 个 Service (club, activity, financial, task, clubTask)
- 10 个 Controller, 8 个路由文件
- 54 个自动化测试 (7 suites, 零回归)
- 前端 7 个页面组, ~18 条路由
- 12 个 npm 运行时依赖
-->

---

## 2. 分层架构 (Layered Architecture)

### 2.1 四层模型

```
┌──────────────────┐
│   Route 层       │  ← 路由定义 + express-validator 校验链 + authorize 中间件
├──────────────────┤
│   Controller 层  │  ← 参数解析 + 调用 Service + 格式化 HTTP 响应
├──────────────────┤
│   Service 层     │  ← 业务逻辑 + 事务管理 + 抛出 ApiError
├──────────────────┤
│   Model 层       │  ← Sequelize ORM + 关联定义 + 数据校验
└──────────────────┘
```

**关键约束**：
- 上层可以调用下层，下层绝不知道上层存在
- Controller 不直接访问 Model（不 import Sequelize 模型）
- Service 不处理 HTTP 语义（不接触 req/res/statusCode）
- 跨层通信只通过函数参数和 ApiError 异常

### 2.2 架构演化：从违反到遵循

**MVP 阶段的问题**——违反分层原则：

```
activityController.js (785行)
  ├── Sequelize 查询 (Model 层逻辑)   ← 越层
  ├── 权限判断 (Service 层逻辑)       ← 越层
  ├── 状态机校验 (Service 层逻辑)     ← 越层
  ├── 审计日志 (横切关注点)           ← 未分离
  └── HTTP 响应格式化                 ← 仅此应在此层
```

**重构后的遵循**：

```js
// Controller 层 — 仅 3 个职责: 校验输入、委托业务、格式化输出
async function createActivity(req, res, next) {
  if (!handleRequestValidation(req, res)) return;          // 1. 校验
  try {
    const activity = await activityService.createActivity({ // 2. 委托
      tenantId: req.tenant.id,
      actorUserId: req.user.id,
      payload: req.body,
    });
    return res.status(201).json({ success: true, data: activity }); // 3. 格式化
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}
```

<!-- ANNOTATION: 分层架构的理论依据

这是 Martin Fowler 在《企业应用架构模式》中描述的经典分层:
- 上层 (Controller/Route) 处理 HTTP 协议细节
- 中层 (Service) 处理领域逻辑——应完全不知道自己是 Web 应用的一部分
- 下层 (Model) 处理持久化——可通过 DB_DIALECT 在 MySQL/SQLite 间切换而不改业务代码

测试性的量化收益:
- Service 层可脱离 HTTP 进行单元测试 (54 个测试中有 36 个是纯 Service 测试)
- 同一 Service 可被 REST API、CLI 脚本、WebSocket 等多个上层复用
 -->

---

## 3. 高内聚低耦合 (Cohesion & Coupling)

### 3.1 定义与度量

| 概念 | 定义 | 本项目目标 |
|------|------|-----------|
| 内聚 (Cohesion) | 模块内部元素的功能相关性 | 每个 Service 文件只处理一个领域聚合 |
| 耦合 (Coupling) | 模块之间的依赖强度 | 模块间仅通过接口（函数签名）通信，不共享实现细节 |

### 3.2 具体实践：错误处理的去耦合

**问题**：6 个 Controller 各自定义副本，修改一处需要修改 6 处。这是典型的**内容耦合 (Content Coupling)**。

**解决**：提取共享模块，所有 Consumer 依赖接口而非实现：

```
重构前:
  clubController → 本地 handleServiceError (25行)
  activityController → 本地 handleServiceError (25行)  ← 完全相同
  financialController → 本地 handleServiceError (25行) ← 完全相同
  clubTaskController → 本地 handleServiceError (25行)  ← 完全相同
  taskController → 本地 handleServiceError (25行)      ← 完全相同
  businessController → 本地 toTenantSafeError          ← 另一种模式

重构后:
  所有 Controller → utils/errorResponse.js (单一定义, 32行)
  修改一次 → 6处同时生效
```

```js
// 所有 Controller 统一导入——这就是依赖倒置
const { handleServiceError, handleRequestValidation } = require("../utils/errorResponse");
```

<!-- ANNOTATION: 耦合度的量化改善

重构前: 5处重复定义 × 25行 = 125行重复代码
        如果修改错误处理逻辑 → 需要同时编辑5个文件 → 高风险遗漏

重构后: 1处定义 × 32行
        修改一次 → 所有 Controller 自动生效

这体现了 DRY (Don't Repeat Yourself) 原则——"每一条知识在系统中必须具有单一、明确、权威的表示"
 -->

### 3.3 授权策略的松耦合

授权逻辑不嵌入任何 Controller 或 Service，而是通过**策略模式 (Strategy Pattern)** 实现：

```js
// Route 层声明"谁可以对什么资源做什么操作"
router.post("/", requireAuth, requireTenantContext,
  authorize("create", "club_task"),  // ← 策略声明，与业务逻辑解耦
  controller);

// authorize 中间件内部调用 evaluatePolicy()
// evaluatePolicy 查询 POLICY 矩阵 (authorization.policy.js)
// 如果某天新增角色或修改权限 → 只改 policy 文件，不改任何 Controller/Service
```

```js
// 策略定义示例 — 纯数据，不含任何执行逻辑
club_task: {
  create: {
    allowTenantRoles: ["tenant_admin"],
    allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    allowClubRoles: ["founder", "admin"],        // ← club-scoped 角色检查
  },
}
```

---

## 4. 防御性编程与纵深防御 (Defense in Depth)

### 4.1 四层护栏模型

请求进入系统后，经过 4 个独立的安全层。每一层独立失败即可拒绝请求——不依赖其他层：

```
Layer 1: 认证层 (Authentication)
  requireAuth → 验证 Bearer JWT → 失败: 401
  ↓ 通过
Layer 2: 租户隔离层 (Tenant Isolation)
  requireTenantContext → 检查 x-tenant-code → 失败: 403
  ↓ 通过
Layer 3: 授权层 (Authorization)
  authorize(action, resource) → RBAC 策略 + 跨租户校验 → 失败: 403
  ↓ 通过
Layer 4: 数据访问层 (Data Access)
  tenantQueryOptions() → 强制注入 tenant_id 过滤 → 失败: Seqeuelize 错误
  ↓ 通过
Controller → Service → Database
```

### 4.2 tenantGuard：数据库级的最后防线

```js
// 即使上层所有代码都忘记加 tenant_id，这一层强制注入
// 这是 Defense in Depth 的最终兜底
function tenantQueryOptions(req, options = {}) {
  return {
    ...options,
    where: {
      ...(options.where || {}),
      tenant_id: req.tenant.id,  // ← 强制注入，不可覆盖
    },
  };
}
// 使用: await Club.findAll(tenantQueryOptions(req, { where: { status: "active" } }))
// 实际 SQL: SELECT * FROM clubs WHERE status = 'active' AND tenant_id = ?
```

### 4.3 接口契约防御：express-validator + handleRequestValidation

```js
// Route 层声明所有合法字段——即使 AI 写的 Controller 忘记校验，Route 层已拦截
router.post("/",
  [
    body("club_id").isInt({ min: 1 }),
    body("title").isString().trim().isLength({ min: 1, max: 200 }),
    body("assignee_id").optional().isInt({ min: 1 }),
    body("assignee_ids").optional().isString(),
    body("priority").optional().isIn(["low", "medium", "high"]),
  ],
  authorize("create", "club_task"),
  controller.createClubTask
);
// Controller 入口: if (!handleRequestValidation(req, res)) return;
// 脏数据在此被拦截，永远进不了 Service 层
```

<!-- ANNOTATION: 为什么纵深防御在 AI 辅助开发中至关重要

AI 偶尔会遗漏安全代码。纵深防御确保:
1. 如果 AI 忘记了 Controller 中的权限检查 → Layer 3 (authorize) 仍然拦截
2. 如果 AI 忘记了 Service 中的 tenant_id 过滤 → Layer 4 (tenantGuard) 仍然拦截
3. 如果 AI 写的校验不完整 → Layer 2 (express-validator) 仍然拦截

这不是"不信任 AI"，而是软件工程中公认的最佳实践——Swiss Cheese Model:
每一层都有漏洞 (holes)，但多层叠加后，漏洞无法对齐，攻击面被消除。
 -->

---

## 5. RBAC 策略引擎的设计模式

### 5.1 策略模式 (Strategy Pattern) + 资源解析器 (Resolver Pattern)

```
authorize("update", "club") 中间件
  │
  ├── 1. evaluatePolicy(action, resource, req)
  │     └── 查询 POLICY 矩阵 → 获取 role allowlist
  │     └── 解析用户角色 (全局角色 + 租户角色 + 社团角色)
  │     └── 角色匹配 → allowed / denied
  │
  └── 2. resolvePolicyResource(resource, req)
        └── 查找目标资源 → 获取 tenant_id
        └── 对比 req.tenant.id → 防跨租户访问
```

```js
// 策略执行函数 (authorization.policy.js)
async function evaluatePolicy({ action, resource, req }) {
  const actionPolicy = POLICY[resource]?.[action];
  if (!actionPolicy) return { allowed: false, reason: "No explicit policy rule" };
  // deny-by-default: 未命中显式策略 → 拒绝

  // 三层角色检查
  const actorGlobalRole = normalizeGlobalRole(req.user.role);
  const actorTenantRole = await resolveTenantRole(req);
  // Club-scoped 资源: 额外检查用户在目标社团中的角色
  if (CLUB_SCOPED_RESOURCES.has(resource) && actionPolicy.allowClubRoles) {
    const scopedClub = await resolveScopedClubForResource(resource, req);
    const actorClubRole = await resolveActorClubRole(req, scopedClub.id);
    if (roleMatches(actorClubRole, actionPolicy.allowClubRoles)) { /* 通过 */ }
  }
  // ... 跨租户校验
}
```

### 5.2 资源解析器的多态

```js
// resource.resolver.js — 对每种资源类型定位其归属的 Club
async function resolveScopedClubForResource(resource, req) {
  if (resource === "club") return resolveClub(req);           // 直接查 Club
  if (resource === "activity") return resolveClubFromActivity(req);  // Activity → Club
  if (resource === "financial_record") return resolveClubFromFinancialRecord(req);
  if (resource === "club_task") { /* ClubTask → Club */ }
  // 创建操作 (无 req.params.id): 从 req.body.club_id 解析
}
```

**设计原则**：单一职责 (SRP) — 策略对象只负责"谁可以做什么"，资源解析器只负责"这个资源属于谁"，两者独立演化。

---

## 6. 事务管理与数据一致性

### 6.1 原子性保证

多表写入操作必须包装在 Sequelize 事务中：

```js
// club.service.js — createClub 同时创建 Club 和 ClubMember
async function createClub({ tenantId, actorUserId, payload }) {
  const transaction = await sequelize.transaction();
  try {
    const club = await Club.create({ ... }, { transaction });
    await ClubMember.create({
      tenant_id: tenantId, club_id: club.id, user_id: founderId, role: "founder",
    }, { transaction });
    await transaction.commit();       // 全部成功 → 提交
    return club;
  } catch (error) {
    await transaction.rollback();     // 任何失败 → 回滚
    throw error;
  }
}
```

**如果不使用事务**：Club 创建成功但 ClubMember 写入失败 → 孤儿社团（没有成员的社团）→ 数据不一致 → 后续所有依赖 ClubMember 的权限检查可能出错。

### 6.2 状态机的正确实现

活动审批流程是一个有限状态机 (Finite State Machine)：

```
draft ──submit──→ pending_approval ──approve──→ approved──complete──→ completed
  ↑                  │                      │
  └── return to draft─┘     ──reject──→ rejected───return to draft──→ draft
```

```js
// activity.service.js — 拒绝"走后门"的状态篡改
function validateStatusTransition(current, next) {
  if (!next || next === current) return { ok: true };
  if (next === "draft" && current === "rejected") return { ok: true };
  if (next === "completed" && current === "approved") return { ok: true };
  return { ok: false, message: `Invalid: ${current} → ${next}` };
  // 其余所有转换组合 → 拒绝。防止通过 PATCH /activities/:id 直接改状态
}
```

---

## 7. 横切关注点 (Cross-Cutting Concerns)

### 7.1 审计日志 (Audit Trail)

审计与业务逻辑解耦——通过统一的 `logAuditEvent()` 函数，而非在每个 Service 中重复：

```js
// 调用方只需传事件描述
logAuditEvent({
  req,                                          // 自动提取 actor 和 tenant
  action: "approval.decision",
  outcome: "success",
  target: { type: "approval", id: approval.id },
  metadata: { decision, activity_id, ... },
});
// 日志格式: {"type":"audit","timestamp":"ISO8601","action":"...","actor":{...},...}
// 输出: logs/audit.log (每行一条 JSON)
```

### 7.2 错误处理的统一策略

```js
// Service 层: 遇到已知错误 → 抛 ApiError
throw new ApiError(404, "CLUB_NOT_FOUND", "Club not found in current tenant.");
//       ApiError(status, code, message, details?)

// Controller 层: 统一 catch → handleServiceError
function handleServiceError(error, res, next) {
  if (error.name === "ApiError")    → 返回 error.status + error.code
  if (error instanceof UniqueConstraintError) → 409 CONFLICT
  if (error instanceof ValidationError)      → 400 VALIDATION_ERROR
  else → next(error)                          → 500 Internal Server Error
}
```

**设计意图**：Service 层不需要知道 HTTP——它只抛出领域异常。HTTP 到异常格式的映射全部由 `handleServiceError` 负责。这是适配器模式的一种体现。

---

## 8. 前端架构决策

### 8.1 路由设计的关注点分离

```
公开路由 (无需认证):
  /              → HomePage
  /club/:id      → PublicClubDetailPage
  /login         → LoginPage
  /register      → RegisterPage

管理路由 (需认证):
  /admin         → DashboardPage
  /admin/clubs   → ClubListPage
  /admin/todos   → TodoListPage
  /admin/club-tasks → ClubTaskListPage
  ...
```

**后端对应**：
- 公开路由使用 `/api/public/*` — 仅 `resolveTenantContext`
- 管理路由使用 `/api/*` — 完整的 `requireAuth → requireTenant → authorize`

### 8.2 状态管理：Context + localStorage

```
AuthContext (React Context):
  - token: localStorage("ccms_token")     ← JWT 持久化
  - user: 解码自 JWT + GET /api/auth/me    ← 含 avatar_url
  - login(), register(), logout(), resetPassword()

apiClient (fetch 封装):
  - 自动附加 Authorization: Bearer <token>
  - 自动附加 x-tenant-code: <code>
  - 统一错误: 401→"登录已失效", 403→"无权操作", 5xx→"服务器错误"

ToastContext (React Context):
  - 全局 toast 通知: create("任务已创建", "success")
  - 3 秒自动消失 + 点击关闭
  - 类型: success / error / warning / info
```

---

## 9. 测试策略 (Testing Pyramid)

### 9.1 层次分布

```
      /\  集成测试 (2 suites, ~14 用例)
     /  \   - antiPrivilege: 跨租户/跨角色授权
    /    \  - approvalFinancialFlow: 审批→财务完整流程
   /------\
  /        \  单元测试 — Service 层 (3 suites, 36 用例)
 /  单元测试 \  - club.service: 14 用例
/   — 审计     \ - activity.service: 12 用例 (状态机 + 权限)
\   (2 suites) / - financial.service: 10 用例 (CRUD + 聚合)
 \   8 用例   /
  \----------/
   单元测试 — 审计日志 (2 suites, 4 用例)
```

**决策依据**：Service 层覆盖了最多的业务逻辑（状态机、权限、事务），因此在这里投入最多测试。集成测试覆盖关键的安全边界（跨租户访问）和业务闭环（审批+财务联动）。

### 9.2 测试隔离设计

```js
// 每个测试在独立数据库中运行
beforeEach(async () => { await syncTestDatabase(); });
// syncTestDatabase() = sequelize.sync({ force: true })
// SQLite :memory: → 每次测试全新数据库 → 无状态污染

// Factory 函数封装常见数据创建
const tenant = await createTenant({ code: "test" });
const { user } = await createUser({ role: "student" });
await addTenantMembership(tenant, user, "member");
const token = signToken(user, tenant);
```

---

## 10. 技术债务管理

### 10.1 识别

| 债务类型 | 位置 | 症状 |
|---------|------|------|
| 重复代码 | 5 个 Controller 中的 handleServiceError | 修改需同时编辑 5 个文件 |
| 分层违反 | activityController 785行 | 业务逻辑、权限、查询全部混在 HTTP 层 |
| 不一致模式 | businessController 使用旧错误处理 | 与其他 5 个 Controller 不同 |
| 缺失测试 | 重构前的 activity/financial 模块 | 无法独立测试业务逻辑 |
| 路由错误 | ClubTaskListPage 缺少 /admin 前缀 | 4 处导航链接 404 |

### 10.2 偿还

| 债务 | 偿还方式 | 效果 |
|------|---------|------|
| 重复代码 | 提取到 errorResponse.js | 6→1, 125行→32行 |
| 分层违反 | 创建 activity.service.js + financial.service.js | Controller 785→130行 |
| 不一致模式 | businessController 改为 import | 全部 10 个 Controller 统一 |
| 缺失测试 | 新增 3 个 Service 测试套件 (36 用例) | 测试覆盖率 54 用例 |
| 路由错误 | 修正 4 处链接 | 修复 404 |

**偿还原则**：在功能扩展之前先偿还结构性债务。因为一旦在债务上构建新功能，偿还成本会指数增长。

---

## 11. AI-Human 协同开发模式

### 11.1 Harness Engineering

**问题**：AI Agent 输出代码速度快（单次对话可能输出数百行），但偶尔出现逻辑发散或遗漏安全点。

**解决方案**：构建代码护栏——让 AI 在预先铺设的安全边界内工作：

1. **合约护栏**：Route 层的 express-validator 链定义了所有合法输入格式——AI 写的 Controller 无论如何处理参数，不合法的数据在 Route 层就被拦截
2. **权限护栏**：authorize 中间件在 Controller 之前执行——即使 AI 完全忘记写权限检查，请求也会被 RBAC 策略引擎裁决
3. **数据护栏**：tenantGuard 在 Sequelize 查询层强制注入 tenant_id——即使 AI 写的查询语句忘记租户过滤，数据库仍只返回当前租户的数据
4. **事务护栏**：Multi-table 写入操作在 Service 层统一使用 Sequelize 事务——AI 不可能写出"部分成功"的数据库操作

### 11.2 文档驱动的 Agent 知识网络

每个组员独立配备 AI Agent。为了让不同 Agent 共享踩坑经验：

```
组员 A 的 Agent 踩坑 "前端 headers 覆盖" 
  → 组员 A 将修复规范写入 experience.md
    → 组员 B 的 Agent 在开发新功能时自动读取 experience.md
      → 组员 B 的 Agent 生成的代码天然免疫此 Bug
```

这就是**以 Markdown 文档为载体的跨 Agent 知识继承**——文档不是"给人看的交接指南"，而是直接成为驯化所有分布式智能体的配置文件。

---

## 12. 工程度量

| 度量项 | 数值 |
|--------|------|
| 总代码行数 (后端, 估计) | ~4500 行 |
| Service 层平均函数长度 | ~20 行 |
| Controller 层平均文件行数 | ~120 行 |
| 测试/源代码比 (Service 层) | ~0.8 |
| 重复代码消除 (重构后) | 125行→32行 (-74%) |
| Controller 代码缩减 | activity: 785→130 (-83%), financial: 837→139 (-83%) |
| 模块间耦合度 | 所有模块通过 interface (函数签名) 通信，0 个直接跨层 Model 访问 |
| API 端点数 | ~55 |
| 数据库迁移 | 14, 全部 up |
| CI 通过率 | 100% (54/54) |

---

## 13. 关键设计决策日志

| 决策 | 选择的方案 | 排除的方案 | 原因 |
|------|-----------|-----------|------|
| 多负责人存储 | `assignee_ids` 逗号分隔 TEXT | 关联表 `club_task_assignees` | 快速验证多委派业务价值，关联表在需要 JOIN 查询时再补 |
| 文件附件表设计 | 单表 `task_attachments` + `task_type` 多态字段 | 两张表 `personal_task_attachments` + `club_task_attachments` | 避免结构重复，操作逻辑统一 |
| ZIP 库选择 | adm-zip (CommonJS) | archiver (ESM) | Jest 无法解析 ESM，测试全部挂掉 |
| 错误处理模式 | 共享 `errorResponse.js`，全部 import | 每个 Controller 本地定义 | 消除内容耦合，修改一次全局生效 |
| 公开/管理分离 | 前端双入口 + 后端双路由前缀 | 全部混在 `/*` 下 | 未登录用户应有内容可看；安全层面物理隔离 |
| Service 层提取时机 | Milestone 2 第一优先级 | 等到功能更多再重构 | 技术债务在添加新功能前偿还，否则成本指数增长 |

<!-- ANNOTATION: 设计决策记录 (ADR) 的价值

每个重大设计决策都记录了:
- 背景 (为什么需要决策)
- 选择的方案
- 排除的方案及排除原因
- 后果 (正面的和需要承担的)

这遵循了 Architecture Decision Record (ADR) 的实践——
让后续接手的人理解"为什么当时这样做"，而不是猜测。
 -->

---

## 14. 总结

**软件工程核心实践**：
1. **分层架构** — Route → Controller → Service → Model，每层单一职责，层间单向依赖
2. **高内聚低耦合** — 消除 125 行重复代码，模块间仅通过接口通信
3. **纵深防御** — 4 层护栏 (认证 → 租户 → 授权 → 数据)，每层独立失败
4. **策略模式** — RBAC 授权引擎与业务逻辑解耦，权限变更不影响 Controller
5. **事务一致性** — 多表写入用 Sequelize 事务保证原子性
6. **状态机正确性** — 专用 action 端点而非通用 PATCH，防止非法状态转移
7. **测试金字塔** — Service 层 36 用例 + 集成测试 14 用例 + 审计测试 4 用例
8. **技术债务管理** — 在功能扩展前偿还结构性债务
9. **Harness Engineering** — 构建安全边界让 AI 在护栏内工作
10. **ADR 决策记录** — 6 个关键设计决策均有记录

<!-- ANNOTATION: 源文件路径索引

架构核心:
  backend/src/middleware/auth.middleware.js
  backend/src/middleware/tenant.middleware.js
  backend/src/middleware/authorize.middleware.js
  backend/src/policies/authorization.policy.js
  backend/src/policies/resource.resolver.js
  backend/src/utils/tenantGuard.js
  backend/src/utils/errorResponse.js
  backend/src/utils/common.js

Service 层:
  backend/src/services/club.service.js (335行, 事务 + 成员管理)
  backend/src/services/activity.service.js (350行, 状态机 + 审批)
  backend/src/services/financial.service.js (287行, CRUD + 聚合)
  backend/src/services/task.service.js (私有待办)
  backend/src/services/clubTask.service.js (多负责人 + 委派)

测试:
  backend/tests/unit/club.service.test.js (14 用例)
  backend/tests/unit/activity.service.test.js (12 用例)
  backend/tests/unit/financial.service.test.js (10 用例)
  backend/tests/unit/auth.audit.test.js
  backend/tests/unit/financial.audit.test.js
  backend/tests/integration/antiPrivilege.test.js
  backend/tests/integration/approvalFinancialFlow.test.js

文档:
  docs/MILESTONE_2_REPORT.md (完整里程碑报告)
  docs/AGILE_PRACTICE_HANDBOOK.md (敏捷实践手册)
  docs/CODE_REVIEW_20260522.md (代码审查报告)
  docs/PRODUCTION_DEPLOYMENT.md (生产部署指南)
  docs/API.md (全部端点文档)
  docs/PERMISSION_MATRIX.md (授权矩阵)
  experience.md (14条工程准则)
  CLAUDE.md (AI 可读项目规范)
 -->
