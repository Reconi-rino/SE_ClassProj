# 部署上线指南（deploy）

本指南用于将当前项目部署为可用环境（单机/单实例版本），适配 MySQL 或 MariaDB。

## 1. 上线前准备

### 1.1 环境要求

- Node.js 18+
- npm 9+
- MySQL 8+ 或 MariaDB 10.5+
- Linux 服务器（推荐）

### 1.2 拉取代码并安装依赖

```bash
git clone <your-repo-url> campus-club-system
cd campus-club-system
npm install
```

## 2. 配置后端环境变量

复制并编辑后端配置：

```bash
cp backend/.env.example backend/.env
```

重点配置项（`backend/.env`）：

```env
PORT=3001
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=campus_club_system
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET=replace_with_secure_secret
JWT_EXPIRES_IN=24h

DEFAULT_ADMIN_EMAIL=admin@ccms.local
DEFAULT_ADMIN_USERNAME=system_admin
DEFAULT_ADMIN_STUDENT_ID=00000000000
DEFAULT_ADMIN_PASSWORD=Admin@123456
```

> 首次启动时会自动创建默认管理员（若不存在），并要求首次登录重设密码。

## 3. 数据库初始化与迁移

### 3.1 创建数据库

```sql
CREATE DATABASE campus_club_system
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

### 3.2 连接检查与迁移

在项目根目录执行：

```bash
npm run db:check
npm run db:migrate
npm run db:migrate:status
```

期望：`db:check` 成功，所有迁移显示 `up`。

## 4. 构建前端

```bash
npm run build -w frontend
```

构建产物目录：`frontend/build/`

## 5. 启动后端服务（生产）

最简单方式：

```bash
npm run start -w backend
```

推荐使用进程守护（示例 PM2）：

```bash
npm i -g pm2
pm2 start backend/src/app.js --name ccms-backend
pm2 save
pm2 startup
```

## 6. 前端静态资源发布

可使用 Nginx 托管 `frontend/build/`，并代理 `/api` 到后端 `3001`。

### Nginx 示例（核心片段）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/campus-club-system/frontend/build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 7. 上线后验收（必做）

### 7.1 健康检查

```bash
curl -sS http://127.0.0.1:3001/api/health
npm run db:check
```

### 7.2 质量检查

```bash
npm run lint
CI=true npm run test
```

### 7.3 关键业务冒烟

- 注册账号（学号必须 11 位数字）
- 管理员登录后强制重设密码
- 创建社团、创建活动、走审批、录入财务并查看报表

## 8. 回滚方案（最低可用）

### 8.1 应用回滚

1. 切回上一版本代码
2. 重新安装依赖并重启服务

```bash
git checkout <previous-tag-or-commit>
npm install
pm2 restart ccms-backend
```

### 8.2 数据库回滚

使用最近备份恢复（见 `docs/OPERABILITY_RUNBOOK.md` 备份恢复章节）。

## 9. 生产运维参考

- 运维 runbook：`docs/OPERABILITY_RUNBOOK.md`
- 发布硬化清单：`docs/RELEASE_HARDENING_CHECKLIST.md`
- 接口文档：`docs/API.md`
- 用户手册：`docs/USER_GUIDE.md`

---

如果你准备部署到云服务器，我可以下一步按你的环境（Ubuntu/CentOS、Nginx/Apache、PM2/Systemd）给你生成一份“可直接复制执行”的命令版上线脚本。  
