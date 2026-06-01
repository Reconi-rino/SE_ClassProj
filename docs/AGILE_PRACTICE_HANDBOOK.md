# 敏捷开发实践手册

> 案例驱动：以"用户头像 + 任务文件附件"功能为例，完整演示从需求分析到交付的敏捷全流程。

## 1. 用户故事与需求拆解

### Epic: 用户身份具象化与任务协作增强

**Story 1.1 — 用户头像与登录状态**
> 作为已登录用户，我希望在公开首页看到自己的头像和用户名，而不是"登录"按钮，这样我知道自己处于登录状态。

**Story 1.2 — 任务文件附件上传**
> 作为任务发布者，我希望在创建待办或社团任务时，能够附加文件（图片、文档等），让任务说明更清晰。

**Story 1.3 — 任务提交文件**
> 作为任务接受者，我在完成任务时可以提交成果文件（报告、截图、设计稿等），作为完成凭证。

**Story 1.4 — 成果文件打包下载**
> 作为任务发布者，我希望一键打包下载所有提交的文件，方便评审和归档。

### 验收标准

| Story | Given | When | Then |
|-------|-------|------|------|
| 1.1 | 已登录用户在首页 | 查看导航栏 | 看到头像+用户名，而非登录按钮 |
| 1.2 | 创建任务时 | 点击上传附件 | 文件成功挂载到任务，列表中可见 |
| 1.3 | 接受者打开任务 | 上传成果文件 | 文件与任务关联，发布者可查看 |
| 1.4 | 发布者查看任务 | 点击"打包下载" | 下载包含所有提交文件的 ZIP 压缩包 |

---

## 2. 技术方案设计

### 2.1 数据库 Schema 变更

#### Migration 1: `add-avatar-to-users` — 用户头像

```sql
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER role;
```

字段说明：存储头像文件的访问 URL 路径（如 `/uploads/avatars/uuid.png`），`NULL` 表示未设置头像。

#### Migration 2: `create-task-attachments` — 通用附件表

```sql
CREATE TABLE task_attachments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT UNSIGNED NOT NULL,
  task_type     ENUM('personal', 'club') NOT NULL,
  task_id       INT UNSIGNED NOT NULL,
  file_name     VARCHAR(255) NOT NULL,          -- 原始文件名
  stored_name   VARCHAR(255) NOT NULL,          -- 存储文件名 (UUID)
  mime_type     VARCHAR(100) NOT NULL,
  file_size     INT UNSIGNED NOT NULL,          -- 字节数
  uploaded_by   INT UNSIGNED NOT NULL,
  attachment_type ENUM('reference', 'submission') NOT NULL DEFAULT 'reference',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_att_tenant_task (tenant_id, task_type, task_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
```

**设计说明**：
- `task_type` + `task_id` 构成多态关联，一张表同时服务 PersonalTask 和 ClubTask
- `attachment_type` 区分"参考资料"（发布者上传）和"提交成果"（接受者上传）
- `stored_name` 使用 UUID 防止文件名冲突
- 文件存储路径：`backend/uploads/{task_type}/{task_id}/{stored_name}`

### 2.2 API 设计

#### 2.2.1 头像接口

```
POST   /api/auth/avatar
  Content-Type: multipart/form-data
  Body: file (image/png, image/jpeg, max 2MB)
  Response: { success: true, data: { avatar_url: "/uploads/avatars/xxx.png" } }

GET    /api/auth/me
  Response: { success: true, data: { ..., avatar_url } }
  (增强：返回 avatar_url 字段)
```

#### 2.2.2 附件接口

```
POST   /api/todos/:id/attachments
  Content-Type: multipart/form-data
  Body: file, attachment_type ("reference"|"submission")
  Response: { success: true, data: { attachment } }

GET    /api/todos/:id/attachments
  Response: { success: true, data: [attachments] }

POST   /api/club-tasks/:id/attachments
  Content-Type: multipart/form-data
  Body: file, attachment_type
  Response: { success: true, data: { attachment } }

GET    /api/club-tasks/:id/attachments
  Response: { success: true, data: [attachments] }

GET    /api/club-tasks/:id/attachments/download
  Response: application/zip (流式下载)
  Query: ?type=submission (可选，只下载提交类文件)
```

#### 2.2.3 静态文件访问

```
GET    /uploads/*    → express.static 映射到 backend/uploads/
  Nginx 生产环境直接 serve，绕过 Node.js
```

### 2.3 文件存储架构

```
backend/uploads/
  avatars/
    {uuid}.png
    {uuid}.jpg
  personal/
    {task_id}/
      {uuid}.pdf
      {uuid}.png
  club/
    {task_id}/
      {uuid}.docx
      {uuid}.jpg
```

**上传限制**：
- 头像：2MB，仅图片（png/jpeg/webp）
- 任务附件：10MB，允许类型：图片、PDF、Office 文档、ZIP
- 单个任务最多 20 个附件

### 2.4 中间件：文件上传处理

使用 `multer` 处理 multipart/form-data：

```js
const multer = require("multer");
const upload = multer({
  storage: multer.diskStorage({ ... }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => { /* MIME 白名单 */ }
});
```

### 2.5 打包下载：ZIP 流式生成

使用 `archiver` 库流式生成 ZIP，不占用大量内存：

```js
const archiver = require("archiver");
archive.pipe(res); // 直接流式输出到 HTTP 响应
archive.file(filePath, { name: originalName });
archive.finalize();
```

---

## 3. 架构影响分析

### 3.1 新增依赖

| 包 | 用途 |
|----|------|
| `multer` | multipart/form-data 解析 |
| `archiver` | ZIP 流式生成 |
| `uuid` | 文件名 UUID 生成 |
| `mime-types` | MIME 类型校验 |

### 3.2 受影响的现有文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `models/User.js` | 新增字段 | `avatar_url` |
| `migrations/` | 新增 2 个 | 头像字段 + 附件表 |
| `controllers/authController.js` | 新增方法 | `uploadAvatar` |
| `routes/auth.routes.js` | 新增路由 | `POST /avatar` |
| `app.js` | 新增中间件 | `express.static("uploads")` + multer 错误处理 |
| `frontend/Public/HomePage.js` | 修改 | 导航栏显示头像/用户名 |
| `frontend/Public/ClubDetailPage.js` | 修改 | 导航栏显示头像/用户名 |
| `frontend/Todos/TodoListPage.js` | 修改 | 附件上传/列表 UI |
| `frontend/ClubTasks/*` | 修改 | 附件上传/下载 UI |

### 3.3 生产部署注意事项

- `backend/uploads/` 目录需创建且可写（`chmod 755`）
- Nginx 配置需添加 `/uploads/` 的静态文件 serve，避免让 Node.js 处理静态文件
- 备份策略需包含 `uploads/` 目录
- 文件大小限制需在 Nginx `client_max_body_size` 中同步设置（建议 15MB）
- 建议使用对象存储（S3/MinIO）替代本地文件系统用于水平扩展

---

## 4. Sprint 规划

### Sprint A: 用户头像与登录状态（1-2 天）

| 任务 | 估时 | 产出 |
|------|------|------|
| Migration: add-avatar-to-users | 0.5h | 新字段 |
| multer 集成 + avatar 上传端点 | 1h | `POST /api/auth/avatar` |
| GET /api/auth/me 增强 | 0.5h | 返回 avatar_url |
| 前端：公开页 Header 组件化 | 2h | 登录/未登录双态 |
| 前端：头像上传 UI（管理后台） | 1h | 头像设置入口 |
| **验收：登录后首页显示头像+用户名** | 0.5h | |

### Sprint B: 任务附件系统（2-3 天）

| 任务 | 估时 | 产出 |
|------|------|------|
| Migration: create-task-attachments | 0.5h | 新表 |
| Attachment 模型 + Service | 2h | CRUD 逻辑 |
| 文件上传端点（todos + club-tasks） | 2h | multer + 校验 |
| 文件列表端点 | 1h | GET attachments |
| ZIP 打包下载端点 | 1.5h | archiver 流式 |
| 前端：附件上传 UI 组件 | 2h | 可复用组件 |
| 前端：附件列表 + 下载按钮 | 1.5h | |
| **验收：完整的上传→查看→下载流程** | 0.5h | |

### Sprint C: 集成测试与文档（1 天）

| 任务 | 估时 | 产出 |
|------|------|------|
| 附件功能单元测试 | 2h | 测试用例 |
| 集成冒烟测试 | 1h | 全流程验证 |
| API 文档更新 | 1h | |
| 用户手册更新 | 0.5h | |

---

## 5. 关键代码示例

### 5.1 multer 配置

```js
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join("uploads", req.params.task_type || "avatars");
    require("fs").mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});

const ALLOWED_MIMES = [
  "image/png", "image/jpeg", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  },
});
```

### 5.2 ZIP 流式下载

```js
const archiver = require("archiver");

async function downloadAttachments(req, res) {
  const attachments = await getAttachments(req.params.id);
  if (attachments.length === 0) {
    return res.status(404).json({ success: false, message: "没有可下载的文件" });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="task-${req.params.id}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  attachments.forEach((att) => {
    archive.file(att.file_path, { name: att.file_name });
  });

  await archive.finalize();
}
```

### 5.3 前端 Header 组件化

```jsx
function PublicHeader() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header style={/* 毛玻璃导航栏 */}>
      <Link to="/">CCMS</Link>
      <div>
        {isAuthenticated ? (
          <>
            <img src={user.avatar_url || "/default-avatar.png"} alt="" />
            <span>{user.username}</span>
            <Link to="/admin">管理后台</Link>
            <button onClick={logout}>退出</button>
          </>
        ) : (
          <>
            <Link to="/login">登录</Link>
            <Link to="/register">加入我们</Link>
          </>
        )}
      </div>
    </header>
  );
}
```

---

## 6. 测试策略

### 6.1 单元测试

```
tests/unit/attachment.service.test.js
  - 上传附件（reference 和 submission 两种类型）
  - 超出大小限制拒绝
  - 不支持的文件类型拒绝
  - 列出任务的附件
  - 打包下载生成有效的 ZIP

tests/unit/auth.avatar.test.js
  - 上传合法图片成功
  - 非图片文件拒绝
  - 超大文件拒绝
```

### 6.2 集成测试

```
1. 注册用户 → 上传头像 → 验证 GET /me 返回 avatar_url
2. 创建社团任务 → 上传 2 个附件 → 列表验证 → 下载 ZIP 验证完整性
3. 任务接受者上传提交文件 → 打包下载时选择仅下载 submission 类型
```

### 6.3 边界测试

- 上传空文件（0 字节）
- 文件名含特殊字符（中文、空格、emoji）
- 并发上传同一任务的附件
- 下载无附件的任务（应返回 404 + 友好提示）
- 单个任务附件数达上限（20 个）

---

## 7. 非功能性需求

| 维度 | 要求 |
|------|------|
| 文件安全 | MIME 白名单 + 扩展名校验 + 病毒扫描（生产环境建议 ClamAV） |
| 存储上限 | 头像 2MB，单个附件 10MB，单任务 20 个附件 |
| 性能 | 文件列表分页（每页 50），ZIP 流式生成不占内存 |
| 隐私 | 附件不可通过猜测 URL 访问（需鉴权中间件保护 `/uploads/` 路径） |
| 备份 | `uploads/` 目录纳入备份范围 |

---

**编写日期**：2026-05-22 · **版本**：v1.0
