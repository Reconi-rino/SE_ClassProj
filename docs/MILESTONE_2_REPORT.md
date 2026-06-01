# 校园社团管理系统 (CCMS) 里程碑报告 — Milestone 2

## 1. 阶段概述

Milestone 2 在 MVP 核心闭环（认证 → 多租户 → 社团 → 活动审批 → 财务）的基础上，将系统从"内部管理工具"升级为"具备公开展示、个人生产力、团队协作能力的完整平台"。本阶段的主题是：**架构深化的系统性重构 + 面向真实场景的功能扩展 + 工程质量的全链路加固**。

### 对比 Milestone 1 的关键指标

| 指标 | Milestone 1 (MVP) | Milestone 2 | 变化 |
|------|-------------------|-------------|------|
| Sequelize 模型 | 8 | **10** | +PersonalTask, ClubTask |
| 数据库迁移 | 8 | **12** | +4 扩展迁移 |
| 后端测试用例 | 8 | **54** | +46 |
| 测试套件 | 4 | **7** | +3 service 层套件 |
| 路由文件 | 5 | **8** | +public, todo, clubTask |
| Controller 文件 | 6 | **9** | +task, clubTask, public |
| Service 文件 | 1 | **5** | +activity, financial, task, clubTask |
| 前端页面组 | 4 | **7** | +Public, Todos, ClubTasks |
| 授权策略资源类型 | 6 | **8** | +personal_task, club_task |
| 前端入口分离 | 无 | **公开/管理双入口** | `/` vs `/admin/*` |
| 代码审查 | 无 | **已完成** | 11 项问题清零 |

---

## 2. 架构演进：从"能跑通"到"可维护"

### 2.1 Service 层全面落地

MVP 阶段仅 `club.service.js` 实现了 Controller → Service → Model 三层分离。其余模块（activity、financial）的业务逻辑全部堆积在 Controller 中——activityController 一度膨胀至 785 行，financialController 达 837 行，包含状态机校验、权限判断、数据查询、审计日志等混合职责。

**重构方案**：
- 提取 `activity.service.js`（8 个导出函数）：createActivity、listActivities、getActivityById、updateActivity、deleteActivity、submitForApproval、listPendingApprovals、decideApproval
- 提取 `financial.service.js`（8 个导出函数）：CRUD + getFinancialMonthlySummary、getFinancialYearlySummary、getFinancialAggregates
- 新增 `task.service.js`（5 个导出函数）和 `clubTask.service.js`（5 个导出函数）
- 所有 Controller 从平均 800+ 行缩减至 ~100 行

**带来的改进**：
- 业务逻辑可独立测试，不再依赖 HTTP 请求
- Service 可以通过 ApiError 抛出语义化错误，Controller 统一捕获
- 相同业务规则不再被多个端点重复实现

### 2.2 错误处理统一收敛

MVP 阶段存在三种并行的错误处理模式：
1. `handleServiceError` + `handleRequestValidation`（clubController 独有）
2. `toTenantSafeError` + `validationError`（activity、financial controller 本地定义）
3. 内联 `validationResult` + 手动 `res.status().json()`（authController、businessController）

**重构方案**：
- 将 `handleServiceError`、`handleRequestValidation`、`toErrorResponse` 统一提取至 `utils/errorResponse.js`
- 所有 9 个 Controller 从此文件 import，删除本地重复定义
- `businessController` 的本地 `parsePositiveInt` 和 `toTenantSafeError` 改为从 `utils/common.js` 和 `utils/errorResponse.js` import
- 此前代码审查发现的 5 处重复定义全部消除

### 2.3 授权策略引擎扩展

Milestone 1 的授权矩阵覆盖 6 种资源类型：tenant_membership、club、club_member、financial_record、activity、approval。Milestone 2 新增：

- **personal_task**（4 actions）：read、create、update、delete，所有 tenant member 可操作自己的任务
- **club_task**（4 actions）：read（club-scoped，支持 club-level 角色检查）、create/update/delete（需 founder/admin）

同时增强了 `resource.resolver.js`：
- 新增 `resolveScopedClubForResource()` 函数，为 activity、approval、financial_record、club_task 资源解析所属 club，实现 club-level 权限检查
- 创建操作（无 `req.params.id`）从 `req.body.club_id` 解析 club

**策略矩阵规模**：从 6 资源 × 约 30 action 组合 → 8 资源 × 约 45 action 组合

### 2.4 公开/管理路由物理分离

MVP 阶段所有路由混杂在一起：`/` 直接指向登录页，未登录用户无法看到任何内容。

**重构方案**：
- **公开层（前端）**：`/`（首页）、`/club/:id`（社团详情）→ 无需 ProtectedRoute
- **管理层（前端）**：`/admin/*` → ProtectedRoute + AppLayout 侧边栏
- **公开层（后端）**：`/api/public/*` → 仅 resolveTenantContext，无 requireAuth
- **管理层（后端）**：`/api/*` → 完整 requireAuth → requireTenantContext → authorize 链

带来的好处：未登录用户可以浏览社团信息，降低使用门槛。管理入口与宣传入口分离，职责清晰。

---

## 3. 新增功能矩阵

### 3.1 个人待办列表（Personal Todo）

**模型**：`PersonalTask` — `personal_tasks` 表，属性：title、description、due_date、priority(enum)、status(enum)，作用域为 `tenant_id + user_id`

**设计决策**：数据按 `user_id` 隔离，不走 RBAC 策略引擎（用户只能操作自己的任务）。后端 service 严格校验 `user_id === actorUserId`，前端分"个人任务"和"被分配的社团任务"两个 Tab 展示。

### 3.2 社团任务发布（Club Task Assignment）

**模型**：`ClubTask` — `club_tasks` 表，核心字段：
- `assignee_id`：主要负责人
- `assignee_ids`：逗号分隔的多负责人 ID 列表（支持委派）
- `activity_id`：可关联活动
- `priority`、`status`、`due_date`

**设计决策**：
- 查看权限：任何 club member
- 创建/编辑/删除：club founder 或 admin
- 被分配人（assignee）可以更新任务状态（认领/完成）
- `/api/club-tasks/my` 端点：按 `assignee_id` 和 `assignee_ids` 双重匹配，跨社团聚合当前用户的所有被分配任务
- "我的待办"页面同时拉取 personal tasks + club tasks，统一展示

### 3.3 公开首页与社团详情

**公开首页**（`/`）：
- Hero 区域（深色渐变背景 + 微网格纹理 + 渐变标题）
- 社团卡片流（封面图优先、毛玻璃统计胶囊、hover 动效）
- IntersectionObserver 驱动的入场动画
- 实时统计栏（社团数 / 成员数 / 活动数）

**社团详情页**（`/club/:id`）：
- 封面大图（带渐变遮罩）
- 统计区域（创始人、成员数、活动数）
- 简介（预格式化展示）
- 近期活动列表（带状态标签）
- CTA 区域（引导注册加入）

**后端公开 API**：
- `GET /api/public/clubs`：返回活跃社团列表 + 成员数/活动数统计（无需认证）
- `GET /api/public/clubs/:id`：返回单个社团详情 + 创始人信息 + 近期活动列表

### 3.4 封面图支持

- 新增 migration 为 `clubs` 表添加 `cover_image_url`（VARCHAR 500）
- Club PATCH 路由 validator 支持该字段
- Service 层 `updateClub` 支持设置/清除封面图
- 前端：有 URL 时展示真实图片，无 URL 时显示渐变色占位 + 社团首字

---

## 4. 工程质量体系

### 4.1 测试覆盖

| 层级 | 文件 | 用例数 |
|------|------|--------|
| 单元测试 — club service | `club.service.test.js` | 14 |
| 单元测试 — activity service | `activity.service.test.js` | 12 |
| 单元测试 — financial service | `financial.service.test.js` | 10 |
| 集成测试 — 授权反越权 | `antiPrivilege.test.js` | ~8 |
| 集成测试 — 审批财务流 | `approvalFinancialFlow.test.js` | ~6 |
| 单元测试 — 审计日志 | `auth.audit.test.js`, `financial.audit.test.js` | ~4 |

测试模式：Jest + Supertest + SQLite 内存数据库。每个测试用 `syncTestDatabase()` 重置数据库。Factory 函数（`createTenant`、`createUser`、`createClub`、`signToken`）封装常见数据创建逻辑。

### 4.2 代码审查

2026-05-22 完成系统性代码审查，覆盖以下维度：
- 未使用的 import（1 项）
- 死代码和遗留调试语句（2 项）
- 路由注册完整性（通过）
- 模型注册和关联完整性（通过）
- 授权中间件覆盖度（3 项）
- 错误处理模式一致性（3 项）
- 前端状态覆盖（全部通过，发现 1 个路由 Bug）
- 共检出 11 项问题，全部修复并归档于 `docs/CODE_REVIEW_20260522.md`

### 4.3 文档体系

Milestone 2 期间全面刷新了文档矩阵：
- 重写 `README.md`：补全路由结构、目录树、技术栈
- 重写 `nextstep.md`：进度快照更新至 2026-05-22
- 更新 `CLAUDE.md`：10 模型图、公开/管理分离、新约定
- 追加 `experience.md` 4 个新条目（#11-14）
- 重写 `docs/USER_GUIDE.md`：从 20% 覆盖到完整功能矩阵
- 重写 `docs/API.md`：补充 30+ 端点文档
- 追加 `docs/PERMISSION_MATRIX.md`：personal_task、club_task 权限行
- 新建 `docs/CODE_REVIEW_20260522.md`：审查报告归档

---

## 5. 教训与经验：从 MVP 到平台化的认知升级

### 5.1 分层不彻底是最大的技术债务

MVP 阶段为了快速闭环，容忍了 activity 和 financial 模块的业务逻辑直接写在 Controller 中。当时认为"功能能跑就行"，但结果是：
- 无法编写单元测试（必须通过 HTTP 才能测试业务逻辑）
- 修改一个业务规则需要在多个端点重复修改
- Controller 文件超过 800 行，新成员难以理解和修改

**教训**：架构分层必须在 MVP 完成后的第一个迭代就进行偿还。Service 层的价值不在于"看起来规范"，而在于**测试性和可维护性的根本改变**。一旦 Service 层建立，所有的后续功能（PersonalTask、ClubTask）都可以直接复用这个模式，新功能的开发速度反而更快。

### 5.2 错误处理一致性是代码质量的底线

MVP 阶段的 6 个 Controller 有 3 种不同的错误处理方式。这种不一致看似无伤大雅，但会导致：
- 同样类型的错误在不同模块中返回不同格式的响应
- 新人不知道该用哪种模式，继续制造更多不一致
- 全局错误处理中间件无法统一拦截

**教训**：错误处理模式应该在第一个 Controller 完成后就提取为共享模块。**两个 Controller 出现同样的代码就应该立即提取**，而不是等到 6 个再动手。

### 5.3 公开/管理分离是面向真实用户的必然选择

MVP 阶段 `/` 直接指向登录页，意味着非注册用户无法看到任何内容。这是一个典型的"开发者视角"设计——假设所有用户都应该先登录。但实际上，社团系统首先是一个**宣传平台**：潜在成员需要先看到有什么社团、社团在做什么，才能决定是否注册。

**教训**：任何时候都应该问自己："一个未登录用户看到的第一屏是什么？"如果答案是一个登录表单，那就需要重新考虑信息架构。

### 5.4 多负责人模式的 pragmatism

在设计 ClubTask 的 assignee 时，完整的关系型设计是创建一张 `club_task_assignees` 关联表（多对多）。但在 MVP 之后的扩展阶段，为了快速验证"多人委派"的业务价值，采用了逗号分隔的 `assignee_ids` 字符串方案。

**权衡**：
- 优势：无需新表、无需额外 JOIN、前端多选直接拼接
- 代价：无法做 SQL 级别的关联查询、无法加外键约束、数据一致性靠应用层保证

**教训**：在功能验证阶段，pragmatic 的简化方案优于完美的关系型设计。但需要在 `experience.md` 中明确标注这是过渡方案，写清楚未来的升级路径。

### 5.5 AI Agent 协同的进阶：从写代码到做审查

MVP 阶段我们让 AI 负责写代码，人工审查。Milestone 2 阶段我们尝试了反向流程：**让 AI 做系统级代码审查**。

实践发现：
- AI 审查可以不遗漏地问诊每一个一致性维度（import、路由注册、授权覆盖、错误处理、状态覆盖）
- 人工审查擅长发现业务逻辑错误和设计意图偏差
- 两者互补：AI 查"做了什么"，人查"为什么要这样做"

一个具体的案例：AI 在审查中发现 `ClubTaskListPage` 中的导航链接缺少 `/admin` 前缀。这是一个在功能开发中极易遗漏的一致性问题，但 AI 通过对比 `App.js` 的路由定义与组件中的 `<Link>` 目标，精准定位了 4 处路径不匹配。

### 5.6 文档即规范：从"写的"到"活的"

MVP 阶段我们建立了文档体系，但 Milestone 2 的大量改动暴露了一个问题：文档很快过时。

**改进措施**：
- 在 CLAUDE.md 中加入了"Key conventions from project history"章节，将约定写成 AI 可直接读取的规则
- 将代码审查结果归档为 `docs/CODE_REVIEW_*.md`，形成可追溯的质量档案
- 在每次功能变更后同步更新 `nextstep.md` 的进度快照
- 保证 `experience.md` 在每次踩坑后立即追加，不依赖记忆

---

## 6. 经验沉淀：14 条工程准则

自项目启动以来，`experience.md` 已累计 14 条工程准则：

| # | 领域 | 核心教训 |
|---|------|---------|
| 1 | 前端封装 | Headers 合并要先拆分再组合，不可直接解构覆盖 |
| 2 | 校验链 | express-validator 用 `.bail()` 限制级联噪声 |
| 3 | 错误展示 | 前端按 msg 去重，保留字段级列表 |
| 4 | 测试隔离 | 不污染默认管理员状态，测试后恢复 |
| 5 | 双通道验证 | curl 正确 ≠ 浏览器正确，两种方式都要测 |
| 6 | 密码策略 | 管理员密码需包含大小写+特殊符号 |
| 7 | 变更清单 | 每次改动后执行最小核查（构建、回归、实操） |
| 8 | 租户闭环 | 注册必须在事务中创建 User + TenantMembership |
| 9 | 主体辨识 | 优先读取 target_user_id，仅在不传时 fallback 到 req.user.id |
| 10 | 状态机 | 复杂流转用专用 action 端点，不用 PATCH 走后门 |
| 11 | 错误收敛 | `handleServiceError` 必须共享，不可本地重复定义 |
| 12 | 路由分离 | 公开页面和管理后台物理隔离，对应不同的后端中间件链 |
| 13 | 资源新增 | 新资源需要 10 步完整流程（migration → model → service → controller → routes → policy → resolver → frontend） |
| 14 | 字段兼容 | 新增模型字段必须同步更新 route validator 和 service update 逻辑 |

---

## 7. 系统全景图

```
                    ┌──────────────────────────┐
                    │     公开访问层 (无需登录)    │
                    │   /           首页          │
                    │   /club/:id   社团详情      │
                    └──────────┬───────────────┘
                               │ /api/public/*
                               │ (仅 tenant 上下文)
                    ┌──────────┴───────────────┐
                    │     管理后台层 (需登录)     │
                    │   /admin/*   全部管理功能  │
                    └──────────┬───────────────┘
                               │ /api/*
                               │ requireAuth → requireTenant → authorize
                    ┌──────────┴───────────────┐
                    │       Controller 层       │
                    │   9 个 controller         │
                    │   统一 handleServiceError  │
                    └──────────┬───────────────┘
                               │
                    ┌──────────┴───────────────┐
                    │       Service 层          │
                    │   5 个 service            │
                    │   业务逻辑 + ApiError      │
                    └──────────┬───────────────┘
                               │
                    ┌──────────┴───────────────┐
                    │       Model 层            │
                    │   10 个 Sequelize 模型     │
                    │   12 个迁移文件            │
                    └──────────────────────────┘
```

## 8. 下一步

Milestone 2 使系统具备了面向真实用户的完整体验闭环。后续方向：

1. **Correlation ID 中间件代码化**：当前为文档策略，需要内建为全局中间件
2. **备份恢复演练**：按 runbook 在预发布环境完成一次完整演练
3. **忘记密码/邮件找回**：当前是唯一缺失的认证功能
4. **活动与财务的集成测试**：当前仅覆盖 service 层
5. **端到端 Playwright 测试**：已搭建环境，待编写完整测试脚本

---
**Milestone 2 完成于 2026-05-22**
