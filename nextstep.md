# Next Steps（实时更新）

## 当前进度快照（Near-Complete）

- ✅ Monorepo（backend/frontend/docs）已稳定运行。
- ✅ 认证闭环已完成：`register/login/me/reset-password`，包含**注册表单强绑定多租户体系**。
- ✅ 多租户基础已落地：`resolveTenantContext` + `requireTenantContext` + `tenantGuard`，前端拦截已对应后端业务沙盒。
- ✅ 业务主链路已落地：clubs、activities/approvals、financial records 路由与策略（修正了社团管理员加人失效问题和表单审批流故障）。
- ✅ Phase B 统一授权中间件已接入核心业务路由。
- ✅ 完整的前后端功能集成自驱测试通过 (Browser-validated End-To-End Flows)。
- ✅ 运维与发布文档已补齐：
  - `docs/OPERABILITY_RUNBOOK.md`
  - `docs/RELEASE_HARDENING_CHECKLIST.md`

## 最终剩余项（Final Items）

> 系统处于“接近可发布”状态，剩余以上线保障与闭环验证为主。

1. **Correlation ID 中间件代码化**（当前为策略文档约束，尚未在后端统一注入/回写）。
2. **备份恢复演练留痕**（按 runbook 在预发布环境完成至少 1 次演练并归档结果）。
3. **发布硬化证据沉淀**（security/perf/rollback 执行记录进入发布记录）。

## 推荐收尾执行顺序

1. 执行一次完整硬化流程（见 `docs/RELEASE_HARDENING_CHECKLIST.md`）。
2. 完成一次“备份→恢复→冒烟”演练（见 `docs/OPERABILITY_RUNBOOK.md`）。
3. 代码化 correlation-id 后做一次回归验证并准备 release tag。

## 最近更新日志

- 2026-03-30：文档补齐健康检查分级、追踪 ID 策略、备份恢复 runbook。
- 2026-03-30：新增发布硬化清单（安全扫描、性能基线、回滚步骤）。
- 2026-03-30：`nextstep.md` 更新为 near-complete 状态与最终剩余项。
- 2026-04-28：修复业务链路中的“多租户越权/逃逸黑洞”和“前后端状态机不对齐”的 Bug。已做完整 UI 回归测试打通主链路。
