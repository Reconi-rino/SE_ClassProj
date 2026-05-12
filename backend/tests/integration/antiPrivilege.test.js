const request = require("supertest");
const { app } = require("../../src/app");
const { syncTestDatabase, db } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub, signToken } = require("../helpers/testData");

async function seedActivityApprovalScenario() {
  const tenant = await createTenant({ code: "tenant-main", name: "Tenant Main" });
  const foreignTenant = await createTenant({ code: "tenant-foreign", name: "Tenant Foreign" });

  const { user: founder } = await createUser({
    username: "founder_user",
    email: "founder@test.local",
    student_id: "10000000021",
    role: "student",
  });
  const { user: approver } = await createUser({
    username: "approver_user",
    email: "approver@test.local",
    student_id: "10000000022",
    role: "student",
  });
  const { user: outsider } = await createUser({
    username: "outsider_user",
    email: "outsider@test.local",
    student_id: "10000000023",
    role: "student",
  });
  const { user: crossTenantAdmin } = await createUser({
    username: "cross_admin",
    email: "crossadmin@test.local",
    student_id: "10000000024",
    role: "club_admin",
  });
  const { user: tenant2Founder } = await createUser({
    username: "tenant2_founder",
    email: "tenant2founder@test.local",
    student_id: "10000000025",
    role: "student",
  });

  await addTenantMembership(tenant, founder, "tenant_admin");
  await addTenantMembership(tenant, approver, "member");
  await addTenantMembership(tenant, outsider, "member");
  await addTenantMembership(foreignTenant, crossTenantAdmin, "tenant_admin");
  await addTenantMembership(foreignTenant, tenant2Founder, "tenant_admin");

  const club = await createClub({ tenant, founder, name: "Main Club" });
  const foreignClub = await createClub({ tenant: foreignTenant, founder: tenant2Founder, name: "Foreign Club" });

  await db.ClubMember.create({
    tenant_id: tenant.id,
    club_id: club.id,
    user_id: approver.id,
    role: "member",
  });
  await db.ClubMember.create({
    tenant_id: tenant.id,
    club_id: club.id,
    user_id: outsider.id,
    role: "member",
  });

  const activity = await db.Activity.create({
    tenant_id: tenant.id,
    club_id: club.id,
    title: "Pending Activity",
    description: "Needs approval",
    start_time: new Date("2026-04-01T10:00:00.000Z"),
    end_time: new Date("2026-04-01T12:00:00.000Z"),
    location: "Hall A",
    status: "pending_approval",
    created_by: founder.id,
  });

  const approval = await db.Approval.create({
    tenant_id: tenant.id,
    activity_id: activity.id,
    approver_id: approver.id,
    status: "pending",
  });

  const financialRecord = await db.FinancialRecord.create({
    tenant_id: tenant.id,
    club_id: club.id,
    type: "expense",
    amount: "300.00",
    category: "transport",
    description: "Bus rental",
    transaction_date: new Date("2026-04-02T00:00:00.000Z"),
    created_by: founder.id,
  });

  return {
    tenant,
    foreignTenant,
    users: { founder, approver, outsider, crossTenantAdmin, tenant2Founder },
    club,
    foreignClub,
    approval,
    financialRecord,
  };
}

describe("Anti-privilege integration tests", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  test("rejects cross-tenant financial mutation", async () => {
    const context = await seedActivityApprovalScenario();
    const token = signToken(context.users.crossTenantAdmin, context.foreignTenant);

    const response = await request(app)
      .put(`/api/financial-records/${context.financialRecord.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-code", context.foreignTenant.code)
      .send({
        amount: 999.99,
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("AUTHORIZATION_DENIED");
    expect(response.body.success).toBe(false);
  });

  test("rejects cross-role approval decision by unassigned member", async () => {
    const context = await seedActivityApprovalScenario();
    const token = signToken(context.users.outsider, context.tenant);

    const response = await request(app)
      .post(`/api/business/approvals/${context.approval.id}/decision`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-code", context.tenant.code)
      .send({
        decision: "approve",
        comments: "I should not be allowed",
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("APPROVAL_OWNERSHIP_DENIED");
  });

  test("rejects cross-tenant club access", async () => {
    const context = await seedActivityApprovalScenario();
    const token = signToken(context.users.founder, context.tenant);

    const response = await request(app)
      .get(`/api/clubs/${context.foreignClub.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-code", context.tenant.code);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("AUTHORIZATION_DENIED");
  });
});
