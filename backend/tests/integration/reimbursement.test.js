/* eslint-env jest */
const request = require("supertest");
const { app } = require("../../src/app");
const { db, syncTestDatabase, closeTestDatabase } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub, signToken } = require("../helpers/testData");

describe("Reimbursement workflow", () => {
  const endpoint = "/api/reimbursements";
  let campus;
  let founder;
  let reviewer;
  let student;
  let club;
  let form;

  function api(method, path, user = founder, tenant = campus) {
    return request(app)[method](path).set("x-tenant-code", tenant.code)
      .set("Authorization", `Bearer ${signToken(user, tenant)}`);
  }

  beforeEach(async () => {
    await syncTestDatabase();
    campus = await createTenant();
    ({ user: founder } = await createUser({ role: "system_admin" }));
    ({ user: reviewer } = await createUser());
    ({ user: student } = await createUser());
    await addTenantMembership(campus, founder);
    await addTenantMembership(campus, reviewer, "tenant_admin");
    await addTenantMembership(campus, student);
    club = await createClub({ tenant: campus, founder });
    form = {
      request_key: "e56c56ab4d414127a84a9e6fabf62443",
      club_id: club.id,
      amount: "128.50",
      category: "活动物料",
      expense_date: "2026-11-01",
      receipt_reference: "R-1205",
      purpose: "校园活动用海报",
    };
  });

  afterAll(closeTestDatabase);

  test("returns, resubmits, approves and books exactly one expense", async () => {
    const { body: { data: created } } = await api("post", endpoint).send(form).expect(201);
    const path = `${endpoint}/${created.id}`;
    expect(created).toMatchObject({ status: "pending", revision: 1 });
    expect((await api("post", endpoint).send(form).expect(200)).body.data.id).toBe(created.id);
    await api("post", `${path}/book`, reviewer).send({ revision: 1, payment_reference: "PAY-10" }).expect(409);
    await api("post", `${path}/review`, reviewer).send({ revision: 1, decision: "return" }).expect(400);
    await api("post", `${path}/review`, reviewer)
      .send({ revision: 1, decision: "return", review_note: "补充印刷用途" }).expect(200);
    const mine = await api("get", endpoint).expect(200);
    expect(mine.body.data.requests).toMatchObject([{ status: "returned", review_note: "补充印刷用途" }]);
    await api("post", `${path}/resubmit`).send({ ...form, revision: 2, purpose: "迎新活动海报印刷" }).expect(200);
    await api("post", `${path}/review`, reviewer).send({ revision: 1, decision: "approve" }).expect(409);
    await api("post", `${path}/review`, reviewer).send({ revision: 3, decision: "approve" }).expect(200);
    expect(await db.FinancialRecord.count()).toBe(0);

    const payment = { revision: 4, payment_reference: "PAY-10" };
    await api("post", `${path}/book`, reviewer).send(payment).expect(200);
    await api("post", `${path}/book`, reviewer).send(payment).expect(200);
    const ledger = await db.FinancialRecord.findAll();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].toJSON()).toMatchObject({ club_id: club.id, type: "expense", reimbursement_id: created.id });
    expect(Number(ledger[0].amount)).toBe(128.50);
    const queue = await api("get", `${endpoint}?scope=review&status=booked`, reviewer).expect(200);
    expect(queue.body.data.requests).toMatchObject([{ financial_record: { id: ledger[0].id } }]);
    await api("delete", `/api/financial-records/${ledger[0].id}`).expect(409);
  });

  test("isolates applications by club, applicant and school", async () => {
    const other = await createTenant({ code: "another-campus" });
    await addTenantMembership(other, reviewer, "tenant_admin");
    await api("post", endpoint, student).send(form).expect(403);
    await api("post", endpoint).send({ ...form, amount: "2.155" }).expect(400);
    const { body: { data: created } } = await api("post", endpoint).send(form).expect(201);
    const path = `${endpoint}/${created.id}`;
    expect((await api("get", endpoint, student).expect(200)).body.data.requests).toEqual([]);
    await api("get", `${endpoint}?scope=review`, student).expect(403);
    await api("post", `${path}/withdraw`, student).send({ revision: 1 }).expect(404);
    await api("post", `${path}/review`, reviewer, other).send({ revision: 1, decision: "approve" }).expect(404);
    await api("post", `${path}/review`).send({ revision: 1, decision: "approve" }).expect(403);
    await api("post", `${path}/withdraw`).send({ revision: 1 }).expect(200);
    await api("post", `${path}/review`, reviewer).send({ revision: 2, decision: "approve" }).expect(409);
    expect(await db.FinancialRecord.count()).toBe(0);
  });

  test("an interrupted booking rolls back the expense and can be retried", async () => {
    const { body: { data: created } } = await api("post", endpoint).send(form).expect(201);
    const path = `${endpoint}/${created.id}`;
    await api("post", `${path}/review`, reviewer).send({ revision: 1, decision: "approve" }).expect(200);
    const payment = { revision: 2, payment_reference: "PAY-RETRY" };
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    db.FinancialRecord.addHook("afterCreate", "interrupt-booking-test", () => {
      throw new Error("Simulated interruption after expense insertion");
    });
    try {
      await api("post", `${path}/book`, reviewer).send(payment).expect(500);
    } finally {
      db.FinancialRecord.removeHook("afterCreate", "interrupt-booking-test");
      log.mockRestore();
    }
    expect(await db.FinancialRecord.count()).toBe(0);
    expect((await db.Reimbursement.findByPk(created.id)).toJSON()).toMatchObject({ status: "approved", revision: 2 });
    await api("post", `${path}/book`, reviewer).send(payment).expect(200);
    expect(await db.FinancialRecord.count()).toBe(1);
  });
});
