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

Returns a single club with founder info, member count, and up to five recently approved or completed activities.

## Personal Todo API (`/api/todos`)

All todo endpoints require `Authorization: Bearer <token>` and `x-tenant-code`. Data is scoped to the authenticated user — users can only see and modify their own tasks.

### POST `/api/todos`

Request body: `{ title (required), description, due_date, priority (low|medium|high) }`

### PATCH `/api/todos/:id`

Request body: `{ title, description, due_date, priority, status (pending|in_progress|completed) }`

Personal task owners can list and upload files at `/api/todos/:id/attachments` and download a ZIP at `/api/todos/:id/attachments/download`.

## Club Task API (`/api/club-tasks`)

All endpoints require `Authorization: Bearer <token>` and `x-tenant-code`.

### GET `/api/club-tasks?club_id=N`

List tasks for a specific club. Requires `club_id` and access to that club. The `assignee_id` filter matches primary and additional assignees.

### GET `/api/club-tasks/my`

Returns tasks assigned to the authenticated user in clubs they can still access (matches by `assignee_id` or `assignee_ids`).

### POST `/api/club-tasks`

Request body: `{ club_id, title, description, assignee_id, assignee_ids (comma-separated, optional), activity_id (optional), due_date, priority }`

### PATCH `/api/club-tasks/:id`

Request body must include `club_id`. Updatable fields: `title, description, assignee_id, assignee_ids, activity_id, due_date, priority, status`. Assignees can update their own task status.

Club managers can upload `reference` files and assignees can upload `submission` files at `/api/club-tasks/:id/attachments`. Users with access to the task can list its files or download a ZIP at `/api/club-tasks/:id/attachments/download`, optionally filtered by `type`.

## Financial Records API (`/api/financial-records`)

All endpoints require `Authorization: Bearer <token>` and `x-tenant-code`. School members can query the monthly summary at `/reports/monthly?year=YYYY&month=M`.

## Activity & Approval API (`/api/business`)

### Activity workflow

1. `POST /api/business/activities` — Create draft activity
2. `POST /api/business/activities/:id/submit-approval` — Submit for school review. The system selects an eligible reviewer when `approver_id` is omitted.
3. `POST /api/business/approvals/:id/decision` — A school or platform administrator approves or rejects (body: `{ decision, comments }`). The submitter and activity creator cannot review it. Rejection requires a reason, shown to the organizer in the activity detail.

### Activity status values
`draft` → `pending_approval` → `approved` or `rejected`. Rejected activities can go back to draft. Approved activities can be cancelled before they start or completed after they end.

`GET /api/business/activities` accepts `status`, `clubId`, `startDate` and `endDate`. The date filters use inclusive calendar dates (YYYY-MM-DD, UTC+08:00) and apply to the activity's start time.

### Activity registration

Run `npm run db:migrate` before deploying the updated application.

When creating an activity or editing a draft or rejected activity, set
`registration_capacity` to an integer from 1 to 10,000. Use `null` to disable
registration. Existing activities start with a null capacity.

Send `x-tenant-code` to select the campus. The business endpoints require a
Bearer token. They return `{ success: true, data: ... }` on success.

| Method and path | Behavior |
| --- | --- |
| `GET /api/public/activities` | Lists future approved activities with a capacity from active clubs. Includes `remaining_places`, including 0 for full activities. Optional `club_id` filters by club. |
| `PUT /api/business/activities/:id/registration` | Registers the caller. A repeat request returns the same registration. Returns 409 if registration is closed or full. |
| `GET /api/business/my-registrations` | Lists the caller's registrations and activity details for the selected campus. |
| `DELETE /api/business/activities/:id/registration` | Cancels the caller's registration and releases the place before the activity starts. Repeating a successful cancellation is safe. |
| `GET /api/business/activities/:id/registrations` | Lists usernames, student IDs and registration times for authorized club managers and campus or platform administrators. |
| `POST /api/business/activities/:id/cancel` | Cancels an approved activity before its start. Requires a non-empty `reason`. Keeps the original registrations and exposes the cancellation notice to those students in their registration list. |
| `PATCH /api/business/activities/:id/registration/cancellation-read` | Marks the caller's cancellation notice read. Repeating the request preserves the first read time. |
| `PUT /api/business/activities/:id/registrations/:userId/attendance` | An authorized organizer records or undoes a registered student's check-in using `{ checked_in: true\|false }`. Available from the start until completion. The roster and the student's registrations include `checked_in_at`. |

## 经费报销 API

全部接口需要 Bearer Token 和 `x-tenant-code`。社团会长和社团管理员可以为自己管理的在用社团提交申请，申请人可以管理自己的单据。学校或平台管理员可以审核和登记付款，申请人不能处理自己提交的申请。

| 方法与路径 | 请求与行为 |
| --- | --- |
| `GET /api/reimbursements` | `scope=mine` 查看自己的申请（默认），`scope=review` 查看当前学校的审核队列。可按 `status` 筛选。返回申请列表、可提交报销的社团以及审核权限。 |
| `POST /api/reimbursements` | 提交 `club_id`、`amount`、`category`、`expense_date`（YYYY-MM-DD）、`purpose`、`receipt_reference` 和 `request_key`（客户端生成的 32 位小写十六进制字符串）。按申请人和学校去重。 |
| `POST /api/reimbursements/:id/review` | 审核待审核申请。提交 `decision=approve` 进入待付款，或 `decision=return` 退回并提供 `review_note`。 |
| `POST /api/reimbursements/:id/resubmit` | 申请人补充已退回单据。提交金额、分类、日期、用途和票据编号，原社团不变。 |
| `POST /api/reimbursements/:id/withdraw` | 申请人撤回待审核或已退回单据，结束处理。 |
| `POST /api/reimbursements/:id/book` | 已在线下付款后提交 `payment_reference`。原子生成一笔支出流水并将申请标记为已入账，重复提交相同凭证不会重复记账。 |

修改、审核、撤回与入账请求均需提交列表返回的 `revision`。版本过期或状态不符时返回 HTTP 409。状态为 `pending`（待审核）、`returned`（退回补充）、`approved`（待付款）、`booked`（已入账）和 `withdrawn`（已撤回）。报销生成的流水含 `reimbursement_id`，通过报销单保留审核关联。上线前执行 `npm run db:migrate`。
