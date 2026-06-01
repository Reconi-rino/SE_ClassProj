# Next Steps（2026-05-22）

## 当前进度快照

- ✅ Monorepo（backend/frontend/docs）稳定运行
- ✅ 认证闭环完成：`register/login/me/reset-password`，包含注册表单强绑定多租户体系
- ✅ 多租户基础设施：`resolveTenantContext` + `requireTenantContext` + `tenantGuard`
- ✅ 统一授权中间件（Phase B）：所有路由接入 `authorize()` RBAC 策略引擎
- ✅ 社团 CRUD + 成员管理（含 `cover_image_url` 封面图）
- ✅ 活动管理 + 审批流（提交-审核-通过/驳回状态机）
- ✅ 财务记录管理（含月度/年度统计，读路由需认证）
- ✅ 个人待办列表（`/admin/todos`，`PersonalTask` 模型，CRUD）
- ✅ 社团任务发布（`/admin/club-tasks`，`ClubTask` 模型，支持多负责人 via `assignee_ids`）
- ✅ 任务委派与"我的任务"聚合（`/api/club-tasks/my` 端点，按登录用户汇总社团任务）
- ✅ 公开首页（`/`）：社团卡片流、Hero 区域、统计数据
- ✅ 公开社团详情页（`/club/:id`）：封面图、简介、近期活动
- ✅ 管理后台与公开页面路由分离（`/admin/*` 需认证）
- ✅ 公开 API（`/api/public/clubs`，`/api/public/clubs/:id`，无需认证）
- ✅ 错误处理统一收敛至 `utils/errorResponse.js`（消除 5 处重复）
- ✅ 代码审查完成并归档（`docs/CODE_REVIEW_20260522.md`），11 个问题全部修复
- ✅ 10 个 Sequelize 模型，12 个迁移文件，54 个后端测试全部通过
- ✅ 前端生产构建通过

## 数据库规模

- **模型**: 10 个（User, Tenant, TenantMembership, Club, ClubMember, Activity, Approval, FinancialRecord, PersonalTask, ClubTask）
- **迁移**: 12 个（8 个基础 schema + 4 个功能扩展）
- **路由文件**: 8 个（auth, public, business, financial, club, tenant, todo, clubTask）
- **Controller**: 9 个，全部统一错误处理模式
- **Service**: 5 个（club, activity, financial, task, clubTask）

## 里程碑文档

- **MVP 里程碑**：`docs/MVP_MILESTONE_REPORT.md`（第一阶段：认证、多租户、社团/活动/审批核心闭环）
- **Milestone 2**：`docs/MILESTONE_2_REPORT.md`（第二阶段：公开展示层、任务协作系统、架构重构、工程质量体系）
- **代码审查**：`docs/CODE_REVIEW_20260522.md`

## 待完成项

1. **Correlation ID 中间件代码化** — 当前为文档策略，尚未在后端统一注入/回写
2. **备份恢复演练留痕** — 按 runbook 在预发布环境完成至少 1 次演练并归档结果
3. **发布硬化证据沉淀** — security/perf/rollback 执行记录进入发布记录
4. **前端 FinancialPublicPage 适配** — 现在月度报告端点是公开的，需确认前端公示页正常工作
5. **Password 恢复流程** — 当前不支持忘记密码/邮件找回

## 推荐下一步

1. Correlation ID 中间件落地 → 全局日志可追踪
2. 预约一次完整的备份恢复演练
3. 补齐前端和 API 文档中的缺失部分（`docs/API.md` 当前仅记录约 40% 的端点）

## 最近更新日志

- 2026-05-22：代码审查通过，11 个问题修复。错误处理统一收敛。财务路由授权加固。
- 2026-05-21：新增 `PersonalTask` 和 `ClubTask` 模型（+4 迁移）。公开首页、社团详情页。封面图字段。管理后台路由分离（/admin/*）。多负责人支持（assignee_ids）。
- 2026-04-28：修复多租户越权/逃逸和前后端状态机不对齐的 Bug。完整 UI 回归测试通过。
- 2026-03-30：文档补齐健康检查分级、追踪 ID 策略、备份恢复 runbook。新增发布硬化清单。
