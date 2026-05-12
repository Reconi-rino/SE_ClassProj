const fs = require("fs");
const request = require("supertest");
const { app } = require("../../src/app");
const { syncTestDatabase } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub, signToken } = require("../helpers/testData");

describe("Financial API unit tests with audit logging", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  test("create financial record writes audit event", async () => {
    const tenant = await createTenant({ code: "finance-tenant" });
    const { user } = await createUser({
      role: "club_admin",
      email: "finance-admin@test.local",
      student_id: "10000000011",
    });
    await addTenantMembership(tenant, user, "tenant_admin");
    const club = await createClub({ tenant, founder: user, name: "Finance Club" });

    const token = signToken(user, tenant);
    const response = await request(app)
      .post("/api/financial-records")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-code", tenant.code)
      .send({
        club_id: club.id,
        type: "income",
        amount: 1200,
        category: "donation",
        description: "Monthly donation",
        transaction_date: "2026-03-01T00:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const entries = fs
      .readFileSync(process.env.AUDIT_LOG_FILE, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const event = entries.find((entry) => entry.action === "financial.create");
    expect(event).toBeTruthy();
    expect(event.metadata).toMatchObject({
      club_id: club.id,
      type: "income",
      category: "donation",
    });
  });
});
