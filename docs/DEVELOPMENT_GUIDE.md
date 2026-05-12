# Campus Club Management System (CCMS) 开发规约与进阶指南

本文档记录了基于真实修复经验所总结出的核心开发规约，供前端及后端开发工程师参考，避免掉入架构和业务流的典型陷阱。

## 一、 多租户 (Multi-Tenant) 生态闭环
系统底层基于严格的租户沙盒模型，所有资源在未识别租户时均表现为 `404 Not Found` 或者 `403 Forbidden`。

### 1. 注册与租户分配原则
- 单纯创建 `User` 记录不再允许作为独立的合法存在。
- **强制锚定**：所有普通非超管账号，在注册链路 (`POST /api/auth/register`) 中必须包裹事务 (Transaction)，并在同属事务内即刻下发 `TenantMembership` 子表关联。如果该链条断裂，会导致“死账号”（可以登录该账号但无法做哪怕最基础的查询）。

### 2. Guard 拦截器规则
后端在绝大部分路由强制叠加了 `requireTenantContext` 与 `tenantGuard` 中间件验证：
- 请求的 Request Header `X-Tenant-Code` 或者 Token 中必须要带有 Tenant 声明。
- 只有被加入到对应 `TenantMembership` 表里的用户，才允许越过中间件去碰后续 Controller；如果有跨租户业务场景，必须使用系统全局管理员下发请求规避租户检查。

## 二、 复杂资源流转与 API 状态机对齐

我们曾遭遇过严重的“活动工单审批无法推进”的故障，原因在于前后端接口状态错位。为了杜绝该现象，应当遵循以下 **API 端点挂载准则**：

### 1. 简单状态更新 vs 复杂状态演进
- **简单字段变更**（例如更新 `description`, `title`），采用 `PATCH /resources/:id`。
- **流转引发关联操作（Side Effect）的状态更改**（例如送审、被驳回、完结归档），**严禁通过 `PATCH` 强行篡改资源属性位！**。
  - **正确做法**：设计子路由节点如 `POST /activities/:id/submit-approval`，在 Controller 中既创建 `Approval` 业务单，又同步将 `Activity` 锁至 pending 状态。
  
### 2. 前后端 Payload 字面量对齐
- 前后端接口调用参数命名必须严格遵守后端的校验管道 (`express-validator`)。如果后端接受对审批工单的主观裁定字段命名为 `decision` 且值限于 `approve` / `reject`，不要试图在前端投递 `status: 'approved'` 给同级接口。

## 三、 用户鉴权与对象操作

### `req.user.id` 不是万能钥匙
在包含有“成员互操作”的设计里，要严格分离主体和客体：
- **场景还原**：如果你设计 `joinClub` 时仅仅写了将 `req.user.id` 加入社团中去，当系统管理员在控制面板上向社团中“添加成员”（传了别的使用者的 id）时，业务逻辑依旧会读取发送者大号的身份执行覆盖，造成灾难性故障。
- **正确的 API Signature**：
  ```javascript
  // 取载荷中的目标账户，否则降级为发出请求的人本身
  const targetUserId = req.body.user_id ? Number(req.body.user_id) : req.user.id;
  ```

## 四、 错误阻挡与脱敏输出

由于系统是向全校区公开的：
1. 请警惕 `Object_NotFound` 与 `Unauthorized` 在跨域环境（或非跨域前端代理环境）下抛错了具体的 DB 字段问题。所有后端的 Validation Error 应该提纯转为脱敏中文给 UI 用以呈现（我们已经在前端的 `errorMessage.js` 统一封装）。
2. 在向数据库更新关联关系前（比如插人落表），用 `findOne` 或 `findByPk` 查探实体存疑不仅能提高友好度，还能避免数据库层直接因为外键约束失败而抛出含有 Table Schema 信息的 Internal Server Error。

---
最后更新于：2026-04-28
