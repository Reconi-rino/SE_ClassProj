# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Campus Club Management System — a monorepo (npm workspaces) with Express backend and React (CRA) frontend. Multi-tenant SaaS for university clubs: activity management, member recruitment, approval workflows, and financial transparency.

- `backend/` — Express API on port 3001
- `frontend/` — React SPA on port 3000 (proxies `/api` to backend)
- `docs/` — API docs, development guide, runbook, hardening checklist

## Commands

All run from repo root unless noted.

```bash
npm install                          # Install all workspace dependencies
npm run dev:backend                  # Start backend with --watch (port 3001)
npm run dev:frontend                 # Start React dev server (port 3000)
npm run build                        # Production frontend build (output: frontend/build/)

# Database (via sequelize-cli through backend workspace)
npm run db:check                     # Test database connection
npm run db:migrate                   # Run pending migrations
npm run db:migrate:status            # Show migration status
npm run db:migrate:undo              # Revert last migration

# Testing
npm test                             # Run all tests (backend + frontend, CI mode)
npm run test -w backend              # All backend tests
npm run test -w frontend             # All frontend tests
npm run test -- -w backend -- --testPathPattern=tests/unit/auth    # Single backend test file

# Linting & formatting
npm run lint                         # Lint all workspaces
npm run lint:fix                     # Lint and auto-fix
npm run format                       # Prettier check
npm run format:write                 # Prettier format in-place
```

Backend-specific (from `backend/`):
```bash
npm test                             # Jest with --runInBand (SQLite in-memory)
npx jest --testPathPattern=tests/unit/auth   # Single test file
```

## Architecture

### Backend request pipeline

Every protected request flows through a 3-layer middleware chain:

```
resolveTenantContext (global) → requireAuth → requireTenantContext → authorize(action, resource) → controller
```

1. **`resolveTenantContext`** — Applied globally. Reads tenant from `x-tenant-code` header or JWT claims. Sets `req.tenant` and `req.tenantResolution`.
2. **`requireAuth`** — Validates `Bearer <JWT>`, sets `req.user`.
3. **`requireTenantContext`** — Blocks if tenant not resolved.
4. **`authorize(action, resource)`** — Policy-based RBAC (deny-by-default). Evaluates against `authorization.policy.js` and cross-checks the resolved resource's `tenant_id` against `req.tenant.id` to prevent cross-tenant access.

### Backend file organization

- **`app.js`** — Express setup, route mounting, server start. Exports `createApp()` for testing.
- **`routes/`** — Route definitions with `express-validator` chains. Auth-required routes wrap in `router.use(requireAuth, requireTenantContext)` then add per-route `authorize()`.
- **`controllers/`** — Thin handlers that parse input, delegate to services, format responses.
- **`services/`** — Business logic with transaction management. Throw `ApiError` for known errors.
- **`models/`** — Sequelize model definitions + `index.js` which sets up all associations.
- **`middleware/`** — `auth.middleware`, `tenant.middleware`, `authorize.middleware`.
- **`policies/`** — `authorization.policy.js` (role/permission matrix) and `resource.resolver.js` (looks up target resource for cross-tenant checks).
- **`utils/tenantGuard.js`** — Programmatic tenant safety: `tenantQueryOptions()`, `tenantCreatePayload()` to enforce `tenant_id` filtering on Sequelize queries.

### Core domain models & associations

```
Tenant ──< TenantMembership >── User
Tenant ──< Club >── User (founder)
Club   ──< ClubMember >── User
Club   ──< Activity >── User (creator)
Activity ──< Approval >── User (approver)
Club   ──< FinancialRecord >── User (creator)
```

Every business table carries `tenant_id`. Models are in `backend/src/models/`, associations defined in `models/index.js`.

### Route design convention

- **Simple field updates** → `PATCH /resource/:id`
- **State transitions with side effects** → dedicated action sub-routes: `POST /activities/:id/submit-approval`, `POST /approvals/:id/decision`
- Never mutate status fields through generic PATCH when the transition creates related records (e.g., Approval rows).

### Frontend

- **`AuthContext`** — Central auth state (token in localStorage key `ccms_token`, user object). Provides `login`, `register`, `logout`, `resetPassword`.
- **`services/apiClient.js`** — `apiRequest()` wrapper around `fetch`. Automatically attaches `Authorization` and `x-tenant-code` headers.
- **`services/`** — Domain-specific API callers (`authApi`, `businessApi`, `tenantApi`).
- **Pages** in `pages/` organized by domain (Activities, Clubs, Finance). Shared UI in `components/Common/`.

### Database

- **Dev/Prod**: MySQL or MariaDB (Sequelize uses `mysql2` dialect)
- **Test**: SQLite in-memory (`DB_DIALECT=sqlite`, `DB_STORAGE=:memory:`)
- Switch via `DB_DIALECT` env var — no code changes needed. See `backend/src/config/database.js`.

### Testing

- Jest with `testEnvironment: "node"`. Test files in `backend/tests/unit/` and `backend/tests/integration/`.
- `backend/tests/setup.js` sets env vars for test (SQLite, test JWT secret, default admin creds).
- `tests/helpers/testDb.js` provides `syncTestDatabase()` (force-recreate tables) and `closeTestDatabase()`.
- Frontend tests in `src/__tests__/` using React Testing Library.

## Environment variables

Copy `backend/.env.example` to `backend/.env`. Required:

- `JWT_SECRET` — server refuses to start without it
- `DB_*` — database connection (defaults to local MySQL with `campus_club_system`)
- `DEFAULT_ADMIN_*` — system admin auto-created on first startup

## Key conventions from project history

- Always wrap multi-table write operations in Sequelize transactions (e.g., user registration creates User + TenantMembership atomically).
- When designing join/add-member endpoints, accept an optional `user_id` in the request body; only fall back to `req.user.id` when not provided. Never hardcode the requester as the target.
- `express-validator` chains should use `.bail()` after type-check validators to avoid cascading noise.
- All frontend API errors are shown via Chinese-localized messages in `errorMessage.js` / `FeedbackMessage` component.
- The `ApiError` class in services carries `{ status, code, message, details }` — controllers catch these and send structured error responses.
