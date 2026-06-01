# Experience Notes（持续更新）

本文件用于沉淀本项目实际踩坑与修复经验，编码前后都应参考，避免重复犯错。

## 1. 请求封装必须避免 headers 被覆盖

### 问题

前端 `fetch` 封装里同时写了：

- 默认 `Content-Type: application/json`
- 再展开 `...options`

如果 `options` 里有 `headers`，会把前面的 `headers` 整体覆盖，导致 `Content-Type` 丢失。后端 `express.json()` 无法解析请求体，出现“字段缺失”“Validation failed”等假象。

### 结论

- 必须先拆分 `options`，再合并 headers：`defaultHeaders + customHeaders`
- 任何需要 JSON body 的请求都必须显式带 `Content-Type: application/json`

## 2. 校验链要用 `bail()` 限制级联噪声

### 问题

`isString()` 失败后继续 `isLength()`，会出现“Invalid value + 长度错误”的重复噪声，用户难以定位真实问题。

### 结论

- 校验顺序：`exists` -> `isString` -> `isLength` -> 业务自定义校验
- 在关键节点后加 `.bail()`，保证一条字段一阶段只报最关键错误

## 3. 前端错误展示要去重

### 问题

后端多条校验错误可能在同一字段重复表达，前端直接渲染会重复显示。

### 结论

- 前端显示前按 `msg` 去重
- 保留字段级列表，避免只显示顶层 `Validation failed`

## 4. 测试时不能污染默认管理员状态

### 问题

手工验证“重设密码成功”会改变默认管理员密码和 `force_password_reset` 状态，影响后续真实使用。

### 结论

- 任何会改变关键账户状态的测试结束后，必须恢复默认值
- 关键账户恢复项：
  - 默认密码
  - `force_password_reset=true`
  - 角色与标识字段一致

## 5. curl 测试与网页测试要双通道验证

### 问题

curl 正常不代表浏览器请求一定正常（请求头、CORS、封装逻辑可能不同）。

### 结论

- 每次接口修复都要做两类验证：
  - curl（快速验证接口本身）
  - 浏览器实际页面提交流程（验证前端请求链路）

## 6. 设计规范（认证与重设密码）

- 重设密码接口采用：`newPassword + confirmNewPassword`
- 管理员密码策略（仅管理员）：
  - 至少一个大写字母
  - 至少一个小写字母
  - 至少一个特殊符号
- 两次新密码必须一致

## 7. 每次改动后的最小核查清单

1. 前端构建通过：`npm run build -w frontend`
2. 后端接口回归：
   - 注册
   - 登录
   - `/api/auth/me`
   - 重设密码（成功/失败分支）
3. 浏览器页面实际操作一次（不是只看 curl）
4. 若动过管理员账户，恢复默认状态并验证 `forcePasswordReset`

## 8. 多租户数据流闭环 (Tenant Context)

### 问题
早期注册时未能处理好租户关联，导致新用户成为无法访问业务模块的孤立用户，产生大量 404 / 403 租户隔断错误。

### 结论
- `authController.register` 中必须引入事务，并在创建 User 后同步创建 `TenantMembership`。
- 只有将用户锚定在正确的租户沙盒内，后继的路由、权限插件才能正常工作。前端表单必须要同步暴露“租户选取”入口，或者后台分配。

## 9. 操作对象辨识 (`req.user.id` vs `target_user_id`)

### 问题
开发“添加社团成员”相关功能时，旧逻辑强行提取当前发送请求人的 `req.user.id`。这就导致具有最高权限的系统管理员在操作添加成员时，后台依然试图把“管理员自己”加进群组。

### 结论
- 对于形如 `join` 或管理性质的操作，API 设计需要留有充足的控制余地（如：优先读取 `req.body.user_id`，只有当不传时，才 fallback 到 `req.user.id`）。
- 权限隔离与实体隔离不冲突，在权限层面准许某动作后，务必在参数层面准确投递目标客体 ID。

## 10. 复杂状态机应该走状态节点请求

### 问题
活动审批时，前端直接用通用的属性更新 API `PATCH /activities/:id` 去尝试把状态扭转为 `pending_approval` 或 `approved`。但这不仅打破了 Express 中间件的字面量验证校验（Validator 拒收了此类跳跃的状态码），且该过程未能真正挂载创建伴生的 `Approval` 流转单记录。

### 结论
- **简单的属性改写**可用 `PATCH`。
- **引发伴生记录创建和状态扭转的**，必须设立独立的 action 挂载点，例如：`POST /activities/:id/submit-approval` 和 `POST /approvals/:id/decision`。
- 前端按钮发出的指令载体需要严格对齐端点语义，不能试图走后门更新模型状态位。

## 11. 错误处理必须集中收敛

### 问题
`handleServiceError` 和 `handleRequestValidation` 在 6 个 controller 中完全重复定义。`businessController` 仍使用旧模式的 `toTenantSafeError`，与其他 controller 不一致。

### 结论
- 所有错误处理函数统一收敛至 `utils/errorResponse.js`
- 所有 controller 从此文件 import，不再本地定义
- 新增 controller 必须遵循此模式

## 12. 公开与管理路由分离

### 问题
初期 `/` 直接是登录页，未登录用户看不到任何内容。

### 结论
- 公开页面（首页、社团详情）使用 `/` 和 `/club/:id`，不走 `ProtectedRoute`
- 管理功能统一挂载在 `/admin/*` 下
- 后端对应 `/api/public/*`（无需认证）和 `/api/*`（需要 auth 链）
- 所有内部导航链接必须使用 `/admin/` 前缀

## 13. 新增资源类型的标准流程

添加新资源（如 `PersonalTask`、`ClubTask`）需经过完整的 10 步流程：
migration → model → index.js 注册 → service → controller → routes → app.js 挂载 → policy → resolver → 前端

缺少任何一步都会导致功能不完整。

## 14. 封面图字段的后向兼容

### 问题
新增 `cover_image_url` 字段时，club PATCH validator 不接受该字段，导致封面图更新被拒。

### 结论
- 新增字段必须同步更新 route validator 的 `body().custom()` 校验
- Service 的 `updateClub` 也需要显式处理新字段
- 前端无封面时显示渐变占位，不应报错

## 最近更新

- 2026-05-22：代码审查通过并修复 11 个问题。错误处理统一收敛。财务路由授权加固。全部文档对齐当前进度。
- 2026-04-28：修复多租户越权和前后端状态机 Bug。完整 UI 回归测试通过。
