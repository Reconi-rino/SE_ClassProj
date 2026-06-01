# API Documentation

This document reflects the **currently implemented** backend endpoints in `backend/src`.

## Base URL

- Local: `http://localhost:3001`
- API prefix: `/api`

## Authentication

Protected endpoints require a JWT in the `Authorization` header:

```http
Authorization: Bearer <token>
```

- Token is returned by `POST /api/auth/register` and `POST /api/auth/login`.
- JWT payload fields currently include:
  - `id`
  - `username`
  - `email`
  - `role` (`student` | `club_admin` | `system_admin`)
  - `forcePasswordReset` (boolean)

### Auth failure responses

- Missing/invalid header:

```json
{
  "success": false,
  "message": "Missing or invalid Authorization header"
}
```

- Invalid/expired token:

```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

## Endpoint List

| Method | Path | Auth Required | Status |
|---|---|---|---|
| GET | `/api/health` | No | Implemented |
| POST | `/api/auth/register` | No | Implemented |
| POST | `/api/auth/login` | No | Implemented |
| GET | `/api/auth/me` | Bearer JWT | Implemented |
| POST | `/api/auth/reset-password` | Bearer JWT | Implemented |
| GET | `/api/clubs` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/clubs/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/clubs` | Bearer JWT + `x-tenant-code` | Implemented |
| PATCH | `/api/clubs/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| DELETE | `/api/clubs/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/clubs/:id/members` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/clubs/:id/members/join` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/clubs/:id/members/leave` | Bearer JWT + `x-tenant-code` | Implemented |
| PATCH | `/api/clubs/:id/members/:memberId/role` | Bearer JWT + `x-tenant-code` | Implemented |
| DELETE | `/api/clubs/:id/members/:memberId` | Bearer JWT + `x-tenant-code` | Implemented |

## Endpoints

### Club domain APIs (`/api/clubs`)

- All club endpoints require:
  - `Authorization: Bearer <token>`
  - `x-tenant-code: <tenant_code>`
- Validation failures return `400` with:
  - `success: false`
  - `code: "VALIDATION_ERROR"`
  - `message`
  - `details` (field-level errors when available)
- Authorization denial returns `403` with:
  - `code: "AUTHORIZATION_DENIED"`
- Enforced policy highlights:
  - `system_admin` can manage clubs and memberships inside resolved tenant context.
  - `tenant_admin` can manage clubs and members inside tenant.
  - `club_admin` can only manage clubs/members where user is `founder/admin` in target club.
  - `student/member` can read, join, leave; cannot perform club admin actions.

## 1) GET `/api/health`

Health check endpoint.

### Request example

```bash
curl -X GET http://localhost:3001/api/health
```

### Success response (200)

```json
{
  "success": true,
  "message": "Backend is running"
}
```

## 2) POST `/api/auth/register`

Register a new user and return a JWT.

### Request body

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "Secret123!",
  "student_id": "20240000001",
  "role": "student"
}
```

### Validation / constraints

- `username`: string, length 3-50
- `email`: valid email format
- `password`: string, length 6-128
- `student_id`: **must be exactly 11 digits** (`^\\d{11}$`)
- `role` (optional): one of `student`, `club_admin`, `system_admin`
- Uniqueness checks:
  - `email` must be unique
  - `username` must be unique
  - `student_id` is unique at model level

### Success response (201)

```json
{
  "success": true,
  "message": "Registered successfully",
  "data": {
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "role": "student",
      "forcePasswordReset": false
    },
    "token": "<jwt>"
  }
}
```

### Error examples

- Validation failed (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "学号必须是11位数字",
      "path": "student_id"
    }
  ]
}
```

- Duplicate email (409)

```json
{
  "success": false,
  "message": "Email already registered"
}
```

- Duplicate username (409)

```json
{
  "success": false,
  "message": "Username already taken"
}
```

## 3) POST `/api/auth/login`

Login with email/password and return a JWT.

### Request body

```json
{
  "email": "alice@example.com",
  "password": "Secret123!"
}
```

### Validation / constraints

- `email`: valid email format
- `password`: string, length 6-128

### Success response (200)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "role": "student",
      "forcePasswordReset": false
    },
    "token": "<jwt>"
  }
}
```

### Error example (401)

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

## 4) GET `/api/auth/me` (Bearer)

Return decoded authenticated user payload from JWT.

### Request example

```bash
curl -X GET http://localhost:3001/api/auth/me \\
  -H "Authorization: Bearer <jwt>"
```

### Success response (200)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "role": "student",
    "forcePasswordReset": false
  }
}
```

## 5) POST `/api/auth/reset-password` (Bearer)

Reset password for the currently authenticated user.

### Request body

```json
{
  "newPassword": "NewPassword123!",
  "confirmNewPassword": "NewPassword123!"
}
```

### Validation / constraints

- `newPassword`: required, string, length 6-128
- `confirmNewPassword`: required, string, length 6-128, must equal `newPassword`
- Additional rule for `system_admin` users:
  - `newPassword` must include:
    - at least one uppercase letter
    - at least one lowercase letter
    - at least one special character

### Success response (200)

```json
{
  "success": true,
  "message": "Password reset successful",
  "data": {
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "role": "student",
      "forcePasswordReset": false
    },
    "token": "<jwt>"
  }
}
```

### Error examples

- Validation failed (400) - mismatch example

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "两次输入的新密码不一致",
      "path": "confirmNewPassword"
    }
  ]
}
```

- Validation failed (400) - `system_admin` complexity example

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "path": "newPassword",
      "msg": "管理员新密码必须包含大写字母、小写字母和特殊符号"
    }
  ]
}
```

- User not found (404)

```json
{
  "success": false,
  "message": "User not found"
}
```

## All Implemented Endpoints (Full Table)

| Method | Path | Auth Required | Status |
|---|---|---|---|
| **Public API** ||||
| GET | `/api/public/clubs` | No (tenant context only) | Implemented |
| GET | `/api/public/clubs/:id` | No (tenant context only) | Implemented |
| **Personal Todos** ||||
| GET | `/api/todos` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/todos/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/todos` | Bearer JWT + `x-tenant-code` | Implemented |
| PATCH | `/api/todos/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| DELETE | `/api/todos/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| **Club Tasks** ||||
| GET | `/api/club-tasks?club_id=` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/club-tasks/my` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/club-tasks/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/club-tasks` | Bearer JWT + `x-tenant-code` | Implemented |
| PATCH | `/api/club-tasks/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| DELETE | `/api/club-tasks/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| **Financial Records** ||||
| GET | `/api/financial-records` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/financial-records/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/financial-records/aggregates` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/financial-records/reports/monthly` | `x-tenant-code` only | Implemented |
| GET | `/api/financial-records/reports/yearly` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/financial-records` | Bearer JWT + `x-tenant-code` | Implemented |
| PUT | `/api/financial-records/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| DELETE | `/api/financial-records/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| **Activities (under /api/business)** ||||
| GET | `/api/business/activities` | Bearer JWT + `x-tenant-code` | Implemented |
| GET | `/api/business/activities/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/business/activities` | Bearer JWT + `x-tenant-code` | Implemented |
| PATCH | `/api/business/activities/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| DELETE | `/api/business/activities/:id` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/business/activities/:id/submit-approval` | Bearer JWT + `x-tenant-code` | Implemented |
| **Approvals (under /api/business)** ||||
| GET | `/api/business/approvals/pending` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/business/approvals/:id/decision` | Bearer JWT + `x-tenant-code` | Implemented |
| **Tenant Memberships (under /api/business)** ||||
| GET | `/api/business/tenant-memberships` | Bearer JWT + `x-tenant-code` | Implemented |
| POST | `/api/business/tenant-memberships` | Bearer JWT + `x-tenant-code` | Implemented |
| PATCH | `/api/business/tenant-memberships/:id/role` | Bearer JWT + `x-tenant-code` | Implemented |
| DELETE | `/api/business/tenant-memberships/:id` | Bearer JWT + `x-tenant-code` | Implemented |

## Public API

### GET `/api/public/clubs`

Returns all active clubs with member and activity counts. No authentication required.

### GET `/api/public/clubs/:id`

Returns a single club with founder info, member count, activity count, and recent activities (up to 5).

## Personal Todo API (`/api/todos`)

All todo endpoints require `Authorization: Bearer <token>` and `x-tenant-code`. Data is scoped to the authenticated user — users can only see and modify their own tasks.

### POST `/api/todos`

Request body: `{ title (required), description, due_date, priority (low|medium|high) }`

### PATCH `/api/todos/:id`

Request body: `{ title, description, due_date, priority, status (pending|in_progress|completed) }`

## Club Task API (`/api/club-tasks`)

All endpoints require `Authorization: Bearer <token>` and `x-tenant-code`.

### GET `/api/club-tasks?club_id=N`

List tasks for a specific club. Requires `club_id` query parameter.

### GET `/api/club-tasks/my`

Returns all tasks assigned to the authenticated user across all clubs (matches by `assignee_id` or `assignee_ids`).

### POST `/api/club-tasks`

Request body: `{ club_id, title, description, assignee_id, assignee_ids (comma-separated, optional), activity_id (optional), due_date, priority }`

### PATCH `/api/club-tasks/:id`

Request body must include `club_id`. Updatable fields: `title, description, assignee_id, assignee_ids, activity_id, due_date, priority, status`. Assignees can update their own task status.

## Financial Records API (`/api/financial-records`)

All write and most read endpoints require `Authorization: Bearer <token>` and `x-tenant-code`. Public monthly summary (`/reports/monthly`) only requires tenant context.

## Activity & Approval API (`/api/business`)

### Activity workflow

1. `POST /api/business/activities` — Create draft activity
2. `POST /api/business/activities/:id/submit-approval` — Submit for approval (creates Approval record, sets activity to `pending_approval`)
3. `POST /api/business/approvals/:id/decision` — Approve or reject (body: `{ decision: "approve"|"reject" }`)

### Activity status values
`draft` → `pending_approval` → `approved` | `rejected` → `completed`
