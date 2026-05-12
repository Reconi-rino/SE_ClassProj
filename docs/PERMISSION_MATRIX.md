# Permission Matrix (Phase B)

This matrix defines the target RBAC policy for the multi-tenant expansion.
It is designed to be **implementation guidance** for `phaseb-authorize-middleware` while staying aligned with current code reality.

## Scope alignment (current vs target)

- **Current enforced global roles in backend**: `system_admin`, `club_admin`, `student`.
- **Planned Phase B roles**: `platform_admin`, `tenant_admin`, `finance_officer`, `student/member` (mapped from current `student`).
- **Planned tenancy model**: most operations become **tenant-scoped** after Phase A (`tenant_id` context + guards).

## Markers

- **A (allow)**: directly allowed.
- **D (deny)**: explicitly denied.
- **C (conditional)**: allowed only when listed condition is true.

## Condition codes

- **C1**: Same-tenant scope only (`actor.tenant_id == resource.tenant_id`).
- **C2**: Club scope only (actor is admin/officer/member of target club within tenant).
- **C3**: Own-record only (actor can act only on own profile/membership request).
- **C4**: Workflow-state guard (e.g., only `draft` can be submitted; only `pending` can be approved/rejected).
- **C5**: Financial control rule (cannot approve/delete own submitted financial record).
- **C6**: Audit export requires elevated scope and reason logging.

## Role-resource-action matrix

| Resource / Action | platform_admin | system_admin (existing) | tenant_admin | club_admin | finance_officer | student/member |
|---|---|---|---|---|---|---|
| **Tenant management** |||||||
| Create tenant | A | C (C6, transitional bootstrap only) | D | D | D | D |
| Update tenant settings | A | C (C1, delegated during transition) | C (C1) | D | D | D |
| Suspend/activate tenant | A | C (C6, emergency only) | D | D | D | D |
| View tenant registry/list | A | C (C6) | C (C1 only) | D | D | D |
| **User membership management** |||||||
| Invite/add user to tenant | A | C (C1) | A (C1) | C (C1,C2 club-bound only) | D | D |
| Remove user from tenant | A | C (C1) | A (C1) | C (C1,C2 cannot remove tenant_admin/system roles) | D | D |
| Change tenant membership role | A | C (C1) | A (C1; except cannot assign platform_admin/system_admin) | C (C1,C2 only club roles) | D | D |
| View membership directory | A | C (C1) | A (C1) | C (C1,C2) | C (C1,C2 finance-relevant clubs) | C (C1,C3 self or public club roster) |
| **Clubs CRUD** |||||||
| Create club | C (C1) | C (C1) | A (C1) | C (C1; if delegated by tenant policy) | D | D |
| Read/list clubs | A | A | A (C1) | A (C1) | A (C1) | A (C1/public clubs) |
| Update club | C (C1) | C (C1) | A (C1) | A (C1,C2 own club) | D | D |
| Delete/archive club | C (C1) | C (C1) | A (C1) | C (C1,C2 own club; archive preferred) | D | D |
| **Club member role assignment** |||||||
| Assign club roles (member/officer) | C (C1) | C (C1) | A (C1) | A (C1,C2) | D | D |
| Assign/revoke club_admin | C (C1) | C (C1) | A (C1) | D | D | D |
| Assign/revoke finance_officer | C (C1) | C (C1) | A (C1) | C (C1,C2 if tenant policy allows) | D | D |
| **Activities workflow** |||||||
| Create activity | C (C1) | C (C1) | C (C1) | A (C1,C2) | C (C1,C2 co-owner) | C (C1,C2 if club policy allows) |
| Submit activity for approval | C (C1,C4) | C (C1,C4) | C (C1,C4) | A (C1,C2,C4) | C (C1,C2,C4) | C (C1,C2,C3,C4 own draft) |
| Approve activity | D | A (C1,C4) | A (C1,C4) | C (C1,C2,C4 if delegated reviewer) | D | D |
| Reject activity | D | A (C1,C4) | A (C1,C4) | C (C1,C2,C4 if delegated reviewer) | D | D |
| **Financial records** |||||||
| Create record | C (C1) | C (C1) | C (C1) | A (C1,C2) | A (C1,C2) | D |
| Update record | C (C1) | C (C1) | C (C1) | A (C1,C2,C4 draft/open only) | A (C1,C2,C4 draft/open only) | D |
| Delete record | C (C1) | C (C1) | C (C1) | C (C1,C2,C4,C5) | C (C1,C2,C4,C5) | D |
| View public financial disclosure | A | A | A (C1) | A (C1) | A (C1) | A (C1/public published only) |
| **Audit log** |||||||
| View audit log | A | A | A (C1) | C (C1,C2 own club events only) | C (C1,C2 finance events only) | D |
| Export audit log | A (C6) | A (C6) | C (C1,C6) | D | D | D |

## Implementation notes for this repository

1. **Backward-compatible mapping (short term)**
   - `system_admin` keeps elevated permissions during transition.
   - current `student` should be treated as `student/member` in policy checks.

2. **Authorization middleware target (next task)**
   - Introduce policy constants: `resource`, `action`, `scope`, `conditions`.
   - Keep authentication (`requireAuth`) separate from authorization (`authorize`).
   - Return `401` for unauthenticated and `403` for denied/failed conditions.

3. **Tenant safety default**
   - For tenant-scoped resources, deny by default when tenant context is missing.
   - Any cross-tenant access requires explicit `platform_admin` (or temporary `system_admin` transitional rule).

4. **Auditability**
   - Approval/rejection and financial mutations should always write audit events.
   - Export actions should capture actor, time range, filters, and reason.
