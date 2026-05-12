const fs = require("fs");
const request = require("supertest");
const { app } = require("../../src/app");
const { syncTestDatabase, db } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub, signToken } = require("../helpers/testData");

describe("Approval and financial integration flow", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  test("assigned approver can approve and writes audit entry", async () => {
    const tenant = await createTenant({ code: "tenant-flow" });
    const { user: founder } = await createUser({
      email: "flow-founder@test.local",
      student_id: "10000000031",
    });
    const { user: approver } = await createUser({
      email: "flow-approver@test.local",
      student_id: "10000000032",
    });

    await addTenantMembership(tenant, founder, "tenant_admin");
    await addTenantMembership(tenant, approver, "member");
    const club = await createClub({ tenant, founder, name: "Flow Club" });
    await db.ClubMember.create({
      tenant_id: tenant.id,
      club_id: club.id,
      user_id: approver.id,
      role: "member",
    });

    const activity = await db.Activity.create({
      tenant_id: tenant.id,
      club_id: club.id,
      title: "Flow Activity",
      description: "Flow test",
      start_time: new Date("2026-04-03T09:00:00.000Z"),
      end_time: new Date("2026-04-03T11:00:00.000Z"),
      location: "Building B",
      status: "pending_approval",
      created_by: founder.id,
    });

    const approval = await db.Approval.create({
      tenant_id: tenant.id,
      activity_id: activity.id,
      approver_id: approver.id,
      status: "pending",
    });

    const approverToken = signToken(approver, tenant);
    const response = await request(app)
      .post(`/api/business/approvals/${approval.id}/decision`)
      .set("Authorization", `Bearer ${approverToken}`)
      .set("x-tenant-code", tenant.code)
      .send({
        decision: "approve",
        comments: "Looks good",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.activity.status).toBe("approved");

    const entries = fs
      .readFileSync(process.env.AUDIT_LOG_FILE, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    const event = entries.find((entry) => entry.action === "approval.decision");
    expect(event).toBeTruthy();
    expect(event.metadata).toMatchObject({
      decision: "approve",
      activity_id: activity.id,
      activity_status: "approved",
    });
  });
});
