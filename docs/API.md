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

## Planned / Not Implemented Endpoints

No additional auth endpoints are documented here as implemented.
Any endpoint not listed in the implemented endpoint table should be treated as **not implemented yet**.
