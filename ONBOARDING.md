# Welcome to SE ClassProj Team

## How We Use Claude

Based on reconi_rino's usage over the last 30 days:

Work Type Breakdown:
  Build Feature    ██████████░░░░░░░░░░  50%
  Improve Quality  ██████░░░░░░░░░░░░░░  25%
  Plan & Design    ████░░░░░░░░░░░░░░░░  15%
  Debug & Fix      ██░░░░░░░░░░░░░░░░░░  10%

Top Skills & Commands:
  /init                  ████████████████████  1x
  /web-design-engineer   ████████████████████  1x

## Your Setup Checklist

### Codebases
- [ ] se_classproj — `git@github.com:reconi-rino/se_classproj.git` (monorepo: Express backend + React frontend)

### MCP Servers to Activate
_No MCP servers configured yet._

### Skills to Know About
- `/init` — Analyzes the codebase and generates a CLAUDE.md with architecture docs, common commands, and conventions. Run this first in any new repo.
- `/web-design-engineer` — Builds high-quality visual web artifacts (landing pages, prototypes, dashboards). Used for the public homepage and club detail pages.

## Team Tips

- **先读 CLAUDE.md** — 它是本项目的 AI 可读规范书，包含架构图、命令表、约定。每个新功能或修 Bug 前先打开它。
- **踩坑立刻记录** — 任何 Bug 修复或踩坑后，立即追加到 `experience.md`。这不仅给人看，也是给后续 AI Agent 的"记忆"。
- **测试是安全网** — 每次改动前后跑 `npm test --workspace=backend`。54 个测试用例全部通过才能提交。新功能必须带测试。
- **错误处理不准重复** — 所有 controller 从 `utils/errorResponse.js` import `handleServiceError` 和 `handleRequestValidation`，禁止本地定义。代码审查会检查。
- **新资源走完整流程** — 添加新模型需要 10 步：migration → model → index.js → service → controller → routes → app.js 挂载 → policy entry → resolver → 前端页面。少一步都会出 Bug。
- **管理页面路由加 /admin 前缀** — Cafe/AppLayout 下的所有 `<Link>` 和 `navigate()` 必须以 `/admin/` 开头，否则 404。
- **Service 层优先** — 业务逻辑放在 `services/` 下，Controller 只是参数解析 + 调用 Service + 格式化响应。Service 抛 `ApiError`，Controller 的 `handleServiceError` 统一接。
- **clubTask 的多负责人字段** — `assignee_id` 是主要负责人，`assignee_ids` 是逗号分隔的多人列表。`GET /api/club-tasks/my` 同时匹配两者。
- **后端 auth 链顺序** — `resolveTenantContext(global) → requireAuth → requireTenantContext → authorize(action, resource) → controller`
- **公开 vs 管理路由分离** — 后端 `/api/public/*` 跳过 `requireAuth`；前端 `/` 和 `/club/:id` 不走 `ProtectedRoute`。其余管理功能全在 `/admin/*` 下。

## Get Started

1. **克隆并安装**
   ```bash
   git clone git@github.com:reconi-rino/se_classproj.git
   cd se_classproj && npm install
   ```

2. **配置环境**
   ```bash
   cp backend/.env.example backend/.env
   # 编辑 backend/.env，填入数据库连接和 JWT_SECRET
   ```

3. **跑通数据库**
   ```bash
   npm run db:check         # 确认连接成功
   npm run db:migrate       # 执行全部迁移
   npm run db:migrate:status  # 确认 14 个迁移都是 up
   ```

4. **运行测试**
   ```bash
   npm test --workspace=backend   # 确认 54 个测试全通过
   npm run build -w frontend      # 确认前端能编译
   ```

5. **启动开发环境**
   ```bash
   npm run dev:backend     # 后端 :3001
   npm run dev:frontend    # 前端 :3000
   ```

6. **阅读关键文档**
   - `CLAUDE.md` — AI 可读规范（必读）
   - `docs/API.md` — 全部端点文档
   - `docs/USER_GUIDE.md` — 用户操作指南
   - `docs/MILESTONE_2_REPORT.md` — 当前系统全景
   - `experience.md` — 踩坑经验库
   - `docs/DEVELOPMENT_GUIDE.md` — 开发规约

7. **上手任务**
   - 用 `admin@ccms.local / 你的密码` 登录 `http://localhost:3000`
   - 浏览公开首页、社团详情
   - 进入 `/admin` 管理后台，创建一个测试社团
   - 在 `/admin/todos` 创建个人待办，在 `/admin/club-tasks` 发布一个社团任务
   - 遇到任何问题，记录到 `experience.md`

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
