# Code Review 2026-05-22

## 严重

1. **社团任务页路由缺少 /admin 前缀** — ClubTaskListPage.js/ClubTaskFormPage.js 中 Link/navigate 仍指向 /club-tasks/*，实际路由在 /admin/club-tasks/*

## 高

2. **businessController.js 仍用旧错误处理模式** — toTenantSafeError + 本地 parsePositiveInt，与其余5个controller不一致
3. **handleServiceError / handleRequestValidation 在5个controller中重复** — 应提取到 utils/errorResponse.js
4. **财务GET路由缺少requireAuth** — /api/financial-records 读操作只需requireTenantContext即可访问
5. **默认管理员密码泄露到stdout** — authController.js:277 console.log明文密码

## 中

6. **resource.resolver.js 中ClubTask懒加载require** — 其他7个model顶部导入，仅有ClubTask在函数体内
7. **todo.routes.js 无authorize()中间件** — 跳过了RBAC策略引擎
8. **publicController.js 错误处理简陋** — res.status(500).json()不走全局handler

## 低

9. **散落console.log/error** — app.js(4处)、auditLogger.js(1处)、RegisterPage.js(1处)
10. **authController校验模式不统一** — 内联validationResult而非handleRequestValidation
11. **审计日志写入失败静默丢弃** — auditLogger.js:65仅console.error
