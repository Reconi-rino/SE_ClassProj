# Campus Club Management System

单仓库（Monorepo）项目，包含：

- `backend/`：Express API 服务（端口 3001）
- `frontend/`：React 前端（端口 3000，开发模式 proxy 到后端）
- `docs/`：项目文档

## 快速开始

1. 安装依赖：

```bash
npm install
```

2. 配置后端环境变量：

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入数据库连接信息和 JWT_SECRET
```

3. 运行数据库迁移：

```bash
npm run db:migrate
```

4. 启动后端：

```bash
npm run dev:backend
```

5. 启动前端：

```bash
npm run dev:frontend
```

6. 浏览器访问：

```text
http://localhost:3000        # 公开首页
http://localhost:3000/admin  # 管理后台（需登录）
```

## 数据库命令

```bash
npm run db:check              # 检查数据库连接
npm run db:migrate            # 执行待处理的迁移
npm run db:migrate:status     # 查看迁移状态
npm run db:migrate:undo       # 回滚最近一次迁移
```

> 已兼容 MariaDB：当前使用 `mysql2 + sequelize`，可直接连接 MariaDB。

## 路由结构

### 公开页面（无需登录）
| 路径 | 说明 |
|------|------|
| `/` | 社团文化展示首页 |
| `/club/:id` | 社团详情页（封面、简介、近期活动） |
| `/login` | 登录 |
| `/register` | 注册 |

### 管理后台（需登录）
| 路径 | 说明 |
|------|------|
| `/admin` | 控制台 |
| `/admin/clubs` | 社团管理 |
| `/admin/activities` | 活动管理 |
| `/admin/approvals` | 审批中心 |
| `/admin/finance` | 财务管理 |
| `/admin/todos` | 我的待办 |
| `/admin/club-tasks` | 社团任务 |

## 目录结构

```text
backend/
  src/
    app.js              # Express 入口
    config/             # 数据库配置
    controllers/        # 路由处理器（薄 controller 模式）
    middleware/          # 认证、租户、授权中间件
    migrations/         # 数据库迁移（12 个文件）
    models/             # Sequelize 模型（10 个）
    policies/           # RBAC 授权策略 + 资源解析器
    routes/             # 路由定义（8 个文件）
    services/           # 业务逻辑层（5 个 service）
    utils/              # 工具函数
  tests/
    unit/               # 单元测试（54 个用例）
    integration/        # 集成测试
    helpers/            # 测试辅助函数
frontend/
  src/
    pages/
      Public/           # 公开页面（首页、社团详情）
      Clubs/            # 社团管理
      Activities/       # 活动管理
      Finance/          # 财务管理
      Todos/            # 个人待办
      ClubTasks/        # 社团任务
    components/         # 共享组件
    services/           # API 调用层
    contexts/           # React Context
docs/                   # 项目文档
```

## 技术栈

- **前端**: React 18, React Router 6, React Testing Library
- **后端**: Node.js, Express, express-validator
- **数据库**: MySQL 8+ / MariaDB 10.5+, SQLite（测试）
- **ORM**: Sequelize（模型、迁移、关联）
- **认证**: JWT (jsonwebtoken + bcrypt)
- **测试**: Jest + Supertest（后端）, React Testing Library（前端）
- **代码质量**: ESLint + Prettier

## 租户隔离数据访问

后端提供 `backend/src/utils/tenantGuard.js`：

- `tenantCreatePayload(req, payload)`：写入时自动注入 `tenant_id`
- `tenantQueryOptions(req, options)`：读/改/删时强制 `where.tenant_id = req.tenant.id`

```js
const { tenantQueryOptions, tenantCreatePayload } = require("../utils/tenantGuard");
await TenantMembership.findAll(tenantQueryOptions(req, { where: { role: "member" } }));
await Club.create(tenantCreatePayload(req, { name: "新社团" }));
```

## 统一授权中间件

所有管理路由接入三层中间件链：

```
resolveTenantContext → requireAuth → requireTenantContext → authorize(action, resource)
```

<<<<<<< HEAD
当前策略要点：

- 默认拒绝（deny-by-default）：未命中显式策略直接 `403`
- 区分认证与授权：`requireAuth` 负责 `401`，`authorize` 负责 `403`
- 租户优先：租户资源在缺少 `req.tenant` 时拒绝；跨租户资源访问拒绝
- 兼容现有角色：保留 `system_admin` 高权限；`student` 映射为 `member` 参与策略扩展
- 可以玩原神
=======
- `authorize.middleware.js` — 策略引擎入口
- `authorization.policy.js` — 角色/权限矩阵（8 个资源类型）
- `resource.resolver.js` — 目标资源查找 + 跨租户校验

>>>>>>> d111958 (fix db secure)
## 运维与发布文档

- 运维 Runbook：`docs/OPERABILITY_RUNBOOK.md`
- 发布硬化清单：`docs/RELEASE_HARDENING_CHECKLIST.md`
- 代码审查报告：`docs/CODE_REVIEW_20260522.md`
- API 文档：`docs/API.md`
- 用户手册：`docs/USER_GUIDE.md`
- 开发规约：`docs/DEVELOPMENT_GUIDE.md`
