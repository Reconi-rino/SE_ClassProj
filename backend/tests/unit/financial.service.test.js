const { syncTestDatabase, db } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub } = require("../helpers/testData");
const financialService = require("../../src/services/financial.service");

describe("financial.service", () => {
  let tenant, founder, member, nonMember;

  beforeEach(async () => {
    await syncTestDatabase();
    tenant = await createTenant();
    const f = await createUser({ username: "founder", email: "founder@test.local", role: "student" });
    founder = f.user;
    await addTenantMembership(tenant, founder, "member");
    const m = await createUser({ username: "member", email: "member@test.local", role: "student" });
    member = m.user;
    await addTenantMembership(tenant, member, "member");
    const nm = await createUser({ username: "outsider", email: "outsider@test.local", role: "student" });
    nonMember = nm.user;
  });

  describe("createFinancialRecord", () => {
    test("club founder can create financial record", async () => {
      const club = await createClub({ tenant, founder });
      const record = await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "income", amount: 1000, category: "Donation", transaction_date: "2026-05-01" },
      });
      expect(record.type).toBe("income");
      expect(Number.parseFloat(record.amount)).toBe(1000);
      expect(record.created_by).toBe(founder.id);
    });

    test("throws for non-club-member", async () => {
      const club = await createClub({ tenant, founder });
      await addTenantMembership(tenant, nonMember, "member");
      await expect(
        financialService.createFinancialRecord({
          tenantId: tenant.id, actorUserId: nonMember.id,
          payload: { club_id: club.id, type: "expense", amount: 50, category: "Food", transaction_date: "2026-05-01" },
        })
      ).rejects.toMatchObject({ name: "ApiError", code: "AUTHORIZATION_DENIED" });
    });

    test("throws with validation errors", async () => {
      const club = await createClub({ tenant, founder });
      await expect(
        financialService.createFinancialRecord({
          tenantId: tenant.id, actorUserId: founder.id,
          payload: { club_id: club.id, type: "invalid", amount: -5, category: "", transaction_date: "not-a-date" },
        })
      ).rejects.toMatchObject({ name: "ApiError", code: "VALIDATION_ERROR" });
    });

    test("throws for non-existent club", async () => {
      await expect(
        financialService.createFinancialRecord({
          tenantId: tenant.id, actorUserId: founder.id,
          payload: { club_id: 99999, type: "income", amount: 100, category: "Test", transaction_date: "2026-05-01" },
        })
      ).rejects.toMatchObject({ name: "ApiError", code: "CLUB_NOT_FOUND" });
    });
  });

  describe("listFinancialRecords", () => {
    test("lists records for a club", async () => {
      const club = await createClub({ tenant, founder });
      await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "income", amount: 500, category: "Fee", transaction_date: "2026-05-01" },
      });
      await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "expense", amount: 100, category: "Food", transaction_date: "2026-05-02" },
      });
      const records = await financialService.listFinancialRecords({
        tenantId: tenant.id, filters: {},
      });
      expect(records).toHaveLength(2);
    });

    test("filters by type", async () => {
      const club = await createClub({ tenant, founder });
      await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "income", amount: 500, category: "Fee", transaction_date: "2026-05-01" },
      });
      await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "expense", amount: 100, category: "Food", transaction_date: "2026-05-02" },
      });
      const records = await financialService.listFinancialRecords({
        tenantId: tenant.id, filters: { type: "income" },
      });
      expect(records).toHaveLength(1);
      expect(records[0].type).toBe("income");
    });
  });

  describe("updateFinancialRecord", () => {
    test("updates record fields", async () => {
      const club = await createClub({ tenant, founder });
      const record = await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "income", amount: 500, category: "Fee", transaction_date: "2026-05-01" },
      });
      const updated = await financialService.updateFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id, id: record.id,
        body: { amount: 800, category: "Updated Fee" },
      });
      expect(Number.parseFloat(updated.amount)).toBe(800);
      expect(updated.category).toBe("Updated Fee");
    });
  });

  describe("deleteFinancialRecord", () => {
    test("deletes record", async () => {
      const club = await createClub({ tenant, founder });
      const record = await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "income", amount: 500, category: "Fee", transaction_date: "2026-05-01" },
      });
      await financialService.deleteFinancialRecord({ tenantId: tenant.id, actorUserId: founder.id, id: record.id });
      const found = await db.FinancialRecord.findByPk(record.id);
      expect(found).toBeNull();
    });
  });

  describe("getFinancialMonthlySummary", () => {
    test("computes correct monthly summary", async () => {
      const club = await createClub({ tenant, founder });
      await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "income", amount: 1000, category: "Fee", transaction_date: "2026-05-10" },
      });
      await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "expense", amount: 300, category: "Food", transaction_date: "2026-05-15" },
      });
      const result = await financialService.getFinancialMonthlySummary({
        tenantId: tenant.id, year: 2026, month: 5,
      });
      expect(result.summary.income).toBe(1000);
      expect(result.summary.expense).toBe(300);
      expect(result.summary.net).toBe(700);
    });
  });

  describe("getFinancialAggregates", () => {
    test("returns totals and by_category", async () => {
      const club = await createClub({ tenant, founder });
      await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "income", amount: 1000, category: "Fee", transaction_date: "2026-05-01" },
      });
      await financialService.createFinancialRecord({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, type: "income", amount: 500, category: "Donation", transaction_date: "2026-05-05" },
      });
      const result = await financialService.getFinancialAggregates({
        tenantId: tenant.id, year: 2026, month: 5,
      });
      expect(result.totals.income).toBe(1500);
      expect(result.by_category).toHaveLength(2);
    });
  });
});
