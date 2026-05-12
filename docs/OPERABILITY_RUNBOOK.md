# Operability Runbook（健康检查 / 追踪ID / 备份恢复）

> 目标：基于**当前仓库已实现能力**提供可执行运维基线。

## 1) 健康检查分级（Health Check Tiers）

当前后端仅实现一个健康接口：`GET /api/health`（`backend/src/app.js`）。
为便于发布与故障定位，建议按以下分层执行：

### Tier 0：存活探针（Liveness）
- **用途**：确认进程可响应 HTTP。
- **命令**：

```bash
curl -sS http://localhost:3001/api/health
```

- **期望**：返回 `{"success":true,"message":"Backend is running"}`。

### Tier 1：依赖探针（Readiness - DB）
- **用途**：确认应用核心依赖（MySQL/MariaDB）可连接。
- **命令（仓库根目录）**：

```bash
npm run db:check
```

- **实现位置**：`backend/src/scripts/checkDbConnection.js`。
- **期望**：输出 `Database connection successful.`，退出码 `0`。

### Tier 2：发布前运行态检查（Pre-release Operability）
- **用途**：确认 schema 状态、代码质量和可构建性。
- **命令（仓库根目录）**：

```bash
npm run db:migrate:status
npm run lint
CI=true npm run test
npm run build
```

- **说明**：
  - `CI=true npm run test` 可避免前端测试进入 watch 模式。
  - Tier 2 失败时，不进入发布步骤。

---

## 2) Trace / Correlation ID 策略

当前代码尚未实现自动 correlation-id 中间件；本策略作为**现阶段执行规范**。

### 2.1 Header 约定
- 客户端 / 网关优先传入：`x-correlation-id`
- 若上游未传入：由入口网关生成（推荐 UUIDv4），并在全链路透传。

### 2.2 日志记录要求
- 每条错误日志至少包含：
  - `timestamp`
  - `route`
  - `method`
  - `status`
  - `x-correlation-id`（若存在）
- 发生故障时，工单与复盘文档必须记录 correlation-id。

### 2.3 API 响应要求（策略）
- 5xx 响应建议回写 `x-correlation-id` 到响应头，便于前后端联合排障。
- 在未落地中间件前，按“日志+网关透传”执行。

---

## 3) 备份与恢复 Runbook（MySQL/MariaDB）

> 以下命令在具备数据库访问权限的运维环境执行。

## 3.1 备份前检查
1. 校验应用健康：

```bash
curl -sS http://localhost:3001/api/health
npm run db:check
```

2. 记录当前 migration 状态：

```bash
npm run db:migrate:status
```

### 3.2 逻辑备份（全库）

```bash
mysqldump -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p --single-transaction --routines --triggers <DB_NAME> > backup-<DB_NAME>-<YYYYMMDDHHmmss>.sql
```

建议将备份文件同步到异地/对象存储并保留校验和。

### 3.3 恢复流程
1. 创建目标库（如不存在）：

```sql
CREATE DATABASE <DB_NAME> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 导入备份：

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> < backup-<DB_NAME>-<timestamp>.sql
```

3. 恢复后校验：

```bash
npm run db:check
npm run db:migrate:status
```

4. 应用验证：

```bash
curl -sS http://localhost:3001/api/health
```

### 3.4 恢复演练建议
- 每月至少一次在预发布环境执行“备份→恢复→冒烟验证”。
- 演练结果需记录：时长、失败点、修复措施、责任人。
