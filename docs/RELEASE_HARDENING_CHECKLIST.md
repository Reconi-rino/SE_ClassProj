# Release Hardening Checklist

> 面向当前仓库（Node.js monorepo: `backend` + `frontend`）的发布前硬化清单。

## A. 安全扫描（Security Scan）

- [ ] 依赖漏洞扫描（生产依赖优先）：

```bash
npm audit --workspaces --omit=dev
```

- [ ] 全量依赖扫描（用于评估 dev 风险）：

```bash
npm audit --workspaces
```

- [ ] 检查高危配置：
  - `backend/.env` 不入库
  - `JWT_SECRET` 已替换强随机值（见 `backend/.env.example`）
  - 默认管理员密码已在部署后立即重置

## B. 质量闸门（Quality Gates）

- [ ] 代码规范：

```bash
npm run lint
```

- [ ] 自动化测试：

```bash
CI=true npm run test
```

- [ ] 前端构建：

```bash
npm run build
```

## C. 性能基线（Performance Baseline）

- [ ] 记录健康接口基线：

```bash
for i in 1 2 3 4 5; do /usr/bin/time -f 'real=%E' curl -sS http://localhost:3001/api/health >/dev/null; done
```

- [ ] 记录关键数据库连通耗时：

```bash
for i in 1 2 3; do /usr/bin/time -f 'real=%E' npm run db:check >/dev/null; done
```

- [ ] 与上一版本基线比对：若明显退化（例如 >20%），暂停发布并分析。

## D. 发布与回滚（Rollback Ready）

- [ ] 发布前记录当前版本信息：Git commit、migration 状态、发布时间窗。
- [ ] 执行 migration 前确认状态：

```bash
npm run db:migrate:status
```

- [ ] 执行 migration：

```bash
npm run db:migrate
```

- [ ] 回滚预案已验证（至少预发布环境演练）：

```bash
npm run db:migrate:undo
```

- [ ] 数据回滚路径明确：可从最近一次可用 `mysqldump` 备份恢复。

## E. 发布后验证（Post-release Verification）

- [ ] `GET /api/health` 正常
- [ ] 核心登录链路（register/login/me）可用
- [ ] 关键业务接口（clubs / business / financial）抽样验证
- [ ] 监控与日志中无新增高频 5xx
