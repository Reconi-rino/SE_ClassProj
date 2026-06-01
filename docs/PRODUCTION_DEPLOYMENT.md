# CCMS 生产环境部署指南

> 架构：应用服务器 + 独立 MySQL 服务器

## 1. 服务器环境要求

### 应用服务器

| 组件 | 最低版本 | 推荐 |
|------|---------|------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Node.js | 18.x | 20.x LTS |
| npm | 9.x | 10.x |
| 反向代理 | Nginx 1.24+ | Nginx 1.26+ |
| 进程管理 | PM2 5.x | PM2 5.x |
| 内存 | 1 GB | 2 GB+ |

### 数据库服务器

| 组件 | 最低版本 | 推荐 |
|------|---------|------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| 数据库 | MySQL 8.0+ 或 MariaDB 10.5+ | MySQL 8.0 |
| 网络 | 与应用服务器内网互通 | 同 VPC / 同机房 |

---

## 2. 角色分工

| 账户 | 用途 | 权限 |
|------|------|------|
| **你的主账户** | 系统配置（安装软件、Nginx、SSL、防火墙） | 有 sudo |
| **ccms** | 运行应用（代码部署、npm、PM2） | 无 sudo，无密码 |

---

## 3. 数据库服务器配置

> 在数据库服务器上由 DBA / 管理员执行。以下为 MySQL 示例。

```sql
-- 创建数据库
CREATE DATABASE campus_club_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（只允许应用服务器 IP 连接）
CREATE USER 'ccms'@'应用服务器内网IP' IDENTIFIED BY '你的强密码';
GRANT ALL PRIVILEGES ON campus_club_system.* TO 'ccms'@'应用服务器内网IP';
FLUSH PRIVILEGES;

-- 验证
mysql -u ccms -h 数据库服务器IP -p -e "SELECT 1;"
```

> **安全要点**：`@'应用服务器内网IP'` 确保只有你的应用服务器能连。不要用 `@'%'`（开放所有 IP）。

---

## 4. 应用服务器环境配置

> 以下全部以主账户身份执行。

### 4.1 创建 ccms 用户

```bash
sudo adduser ccms --disabled-password
```

### 4.2 安装 Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version     # 应显示 v20.x
```

### 4.3 安装 PM2

```bash
sudo npm install -g pm2
```

### 4.4 安装 Nginx

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 4.5 防火墙

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp    # SSH
sudo ufw enable
```

### 4.6 验证数据库连通性

```bash
# 应用服务器需要能到达数据库服务器的 3306 端口
# 如果连接失败，检查数据库服务器的防火墙/安全组
sudo apt-get install -y mysql-client   # 仅用于调试，非必须
mysql -u ccms -h 数据库服务器IP -p -e "SELECT 1;"
```

---

## 5. 应用部署

> 切换到 ccms 用户（以下全部以 ccms 身份执行）

```bash
sudo su - ccms
```

### 5.1 拉取代码

```bash
cd /home/ccms
git clone https://github.com/reconi-rino/se_classproj.git ccms
cd ccms
npm install
```

### 5.2 配置环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`：

```env
PORT=3001
NODE_ENV=production

# 数据库连接（远程 MySQL 服务器）
DB_HOST=数据库服务器内网IP
DB_PORT=3306
DB_NAME=campus_club_system
DB_USER=ccms
DB_PASSWORD=你的数据库密码

# MySQL SSL 连接（如果数据库服务器开启了 require_secure_transport）
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false   # 内网自签名证书用 false，正规 CA 证书用 true

# 生成强随机密钥
JWT_SECRET=openssl rand -hex 64 的结果

# 修改默认管理员密码！
DEFAULT_ADMIN_EMAIL=admin@your-school.edu.cn
DEFAULT_ADMIN_USERNAME=system_admin
DEFAULT_ADMIN_STUDENT_ID=00000000000
DEFAULT_ADMIN_PASSWORD=生成一个强密码
```

生成 JWT_SECRET：

```bash
openssl rand -hex 64
```

### 5.3 构建与迁移

```bash
npm run build -w frontend           # 前端构建 → frontend/build/
npm run db:check                    # 确认远程数据库连接成功
npm run db:migrate                  # 执行 14 个迁移（在远程数据库上建表）
npm run db:migrate:status           # 确认全部 up
```

### 5.4 创建上传目录

```bash
mkdir -p /home/ccms/ccms/backend/uploads/{avatars,personal,club}
chmod 755 /home/ccms/ccms/backend/uploads
```

### 5.5 启动应用

创建 `/home/ccms/ccms/ecosystem.config.js`：

```js
module.exports = {
  apps: [{
    name: "ccms-backend",
    script: "backend/src/app.js",
    cwd: "/home/ccms/ccms",
    env: {
      NODE_ENV: "production"
    },
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "512M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/home/ccms/logs/error.log",
    out_file: "/home/ccms/logs/out.log",
  }]
};
```

```bash
mkdir -p /home/ccms/logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd   # 按提示粘贴 command 设置开机自启
```

---

## 6. Nginx 配置

> 切回主账户执行

```bash
exit    # 退出 ccms
```

### 6.1 站点配置

```bash
sudo nano /etc/nginx/sites-available/ccms
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    access_log /var/log/nginx/ccms-access.log;
    error_log  /var/log/nginx/ccms-error.log;

    client_max_body_size 15m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 60s;
        proxy_pass_request_headers on;
    }

    location /uploads/ {
        alias /home/ccms/ccms/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location / {
        root /home/ccms/ccms/frontend/build;
        index index.html;
        try_files $uri /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
            root /home/ccms/ccms/frontend/build;
        }
    }

    location ~ /\. { deny all; }
}
```

### 6.2 启用

```bash
sudo ln -s /etc/nginx/sites-available/ccms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. SSL 配置（Let's Encrypt）

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo certbot renew --dry-run
```

---

## 8. 部署后验证

### 8.1 健康检查

```bash
curl -sS https://your-domain.com/api/health
```

### 8.2 冒烟测试

```bash
# 公开首页
curl -sS -o /dev/null -w "首页: HTTP %{http_code}\n" https://your-domain.com/

# 公开 API
curl -sS https://your-domain.com/api/public/clubs | python3 -c "
import sys,json; d=json.load(sys.stdin)
print(f'社团数: {len(d[\"data\"])}')"

# 登录
curl -sS https://your-domain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@your-school.edu.cn","password":"你的管理员密码"}'
```

### 8.3 浏览器验证

| URL | 验证项 |
|-----|--------|
| `https://your-domain.com/` | 公开首页 |
| `https://your-domain.com/club/1` | 社团详情 |
| `https://your-domain.com/admin` | 登录后进入管理后台 |

---

## 9. 备份策略

### 9.1 远程数据库备份

> 从应用服务器发起，连接到远程数据库执行 dump。

创建 `/home/ccms/backup.sh`（以 ccms 身份）：

```bash
#!/bin/bash
BACKUP_DIR=/home/ccms/backups
DB_HOST=数据库服务器内网IP
DB_NAME=campus_club_system
DB_USER=ccms
DB_PASS=你的数据库密码
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 从远程数据库备份
mysqldump -h $DB_HOST -u $DB_USER -p"$DB_PASS" \
  --single-transaction --routines --triggers $DB_NAME \
  | gzip > $BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz

# 上传文件备份
tar -czf $BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz -C /home/ccms/ccms/backend uploads 2>/dev/null

# 保留 30 天
find $BACKUP_DIR -mtime +30 -delete
```

```bash
chmod 600 /home/ccms/backup.sh   # 含数据库密码，必须限制权限
chmod +x /home/ccms/backup.sh

# crontab：每天凌晨 2 点
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ccms/backup.sh >> /home/ccms/logs/backup.log 2>&1") | crontab -
```

> **注意**：备份脚本包含数据库密码，`chmod 600` 确保只有 ccms 用户能读取。

### 9.2 恢复

```bash
gunzip < backup.sql.gz | mysql -h 数据库服务器IP -u ccms -p campus_club_system
tar -xzf uploads_XXXX.tar.gz -C /home/ccms/ccms/backend/
curl -sS https://your-domain.com/api/health
```

---

## 10. 更新部署

> 以 ccms 身份执行

```bash
sudo su - ccms
cd /home/ccms/ccms
git pull origin main
npm install
npm run build -w frontend
npm run db:migrate        # 如有新迁移
pm2 restart ccms-backend
```

迁移失败则回滚：

```bash
npm run db:migrate:undo
git checkout <上一个正常版本>
npm install && npm run build -w frontend
pm2 restart ccms-backend
```

---

## 11. 日常运维

### ccms 身份

```bash
pm2 status               # 进程状态
pm2 logs ccms-backend    # 实时日志
pm2 monit                # 性能
pm2 flush                # 清理日志
df -h                    # 磁盘
```

### 主账户

```bash
sudo tail -f /var/log/nginx/ccms-access.log
```

---

## 12. 安全清单

| 层级 | 检查项 |
|------|--------|
| 数据库 | 用户仅允许应用服务器 IP 连接（非 `%`） |
| 数据库 | 使用非 root 用户 |
| 数据库 | 3306 端口不对外暴露（仅内网可达） |
| 应用 | `.env` 权限 600 |
| 应用 | JWT_SECRET ≥ 64 字符 |
| 应用 | 默认管理员密码已修改 |
| 应用 | `ccms` 用户无 sudo、无密码、无法 SSH |
| 网络 | 防火墙仅开放 80 / 443 / 22 |
| 传输 | SSL 证书已配置 |
| 运维 | 备份脚本已测试，权限 600 |
| 系统 | SSH 密钥登录（禁用密码） |
| 系统 | `unattended-upgrades` 已启用 |

---

## 13. 故障排查

| 现象 | 检查项 |
|------|--------|
| 502 Bad Gateway | `pm2 status`；后端是否在 3001 |
| 数据库连接失败 | 应用服务器能否 telnet 数据库 IP:3306；CCMS 用户是否有远程连接权限 |
| 静态资源 404 | `frontend/build/` 是否存在；Nginx root 路径 |
| 登录后无限跳转 | JWT_SECRET 一致；清除 localStorage |
| 迁移失败 | `npm run db:migrate:status` |
| 上传文件无法访问 | `/home/ccms/ccms/backend/uploads/` 目录权限是否 755 |

---

**部署完成后：**
1. 修改默认管理员密码（首次登录强制重设）
2. 创建测试社团，走通 创建→加入→活动→审批→财务→任务→待办
3. 执行一次远程备份恢复演练
