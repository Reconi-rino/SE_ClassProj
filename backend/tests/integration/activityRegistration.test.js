/* eslint-env jest */
const request = require("supertest");
const { app } = require("../../src/app");
const { db, syncTestDatabase, closeTestDatabase } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub, signToken } = require("../helpers/testData");

describe("Activity registration", () => {
  let tenant;
  let club;
  let founder;
  let student;
  let otherStudent;

  function api(method, path, user, campus = tenant) {
    const req = request(app)[method](path).set("x-tenant-code", campus.code);
    return user ? req.set("Authorization", `Bearer ${signToken(user, campus)}`) : req;
  }

  function makeActivity(overrides = {}) {
    return db.Activity.create({
      title: "Campus tour",
      tenant_id: tenant.id,
      club_id: club.id,
      created_by: founder.id,
      start_time: new Date(Date.now() + 86400000),
      status: "approved",
      registration_capacity: 1,
      ...overrides,
    });
  }

  beforeEach(async () => {
    await syncTestDatabase();
    tenant = await createTenant();
    ({ user: founder } = await createUser());
    ({ user: student } = await createUser());
    ({ user: otherStudent } = await createUser());
    await addTenantMembership(tenant, founder);
    await addTenantMembership(tenant, student);
    await addTenantMembership(tenant, otherStudent);
    club = await createClub({ tenant, founder });
  });

  afterAll(closeTestDatabase);

  test("opens registration after approval and validates draft capacity", async () => {
    const newActivity = await api("post", "/api/business/activities", founder).send({
      club_id: club.id,
      title: "New campus activity",
      start_time: new Date(Date.now() + 86400000).toISOString(),
    }).expect(201);
    const id = newActivity.body.data.id;
    expect(newActivity.body.data.registration_capacity).toBeNull();
    const activityPath = `/api/business/activities/${id}`;
    await api("patch", activityPath, founder).send({ registration_capacity: 0 }).expect(400);
    await api("patch", activityPath, founder).send({ registration_capacity: 2 }).expect(200);
    expect((await api("get", "/api/public/activities").expect(200)).body.data).toEqual([]);
    await api("post", `${activityPath}/submit-approval`, founder).send({ approver_id: otherStudent.id }).expect(400);
    const { user: reviewer } = await createUser();
    await addTenantMembership(tenant, reviewer, "tenant_admin");
    await api("post", `${activityPath}/submit-approval`, founder).send({}).expect(200)
      .then(({ body }) => api("post", `/api/business/approvals/${body.data.approval.id}/decision`, reviewer)
        .send({ decision: "approve" }).expect(200));
    await api("patch", activityPath, founder).send({ registration_capacity: 1 }).expect(409);
    const publicList = await api("get", `/api/public/activities?club_id=${club.id}`).expect(200);
    expect(publicList.body.data).toMatchObject([{ id, remaining_places: 2 }]);
  });

  test("keeps the roster private, prevents duplicate signups, and releases cancelled places", async () => {
    const activity = await makeActivity();
    const endpoint = `/api/business/activities/${activity.id}/registration`;
    const rosterPath = `${endpoint}s`;
    await api("put", endpoint).expect(401);
    await api("put", endpoint, student).send({ user_id: otherStudent.id }).expect(200);
    await api("put", endpoint, student).expect(200);
    const full = await api("put", endpoint, otherStudent).expect(409);
    expect(full.body.code).toBe("ACTIVITY_FULL");
    expect((await api("get", "/api/public/activities").expect(200)).body.data).toMatchObject([
      { id: activity.id, remaining_places: 0 },
    ]);
    expect((await api("get", "/api/business/my-registrations", student).expect(200)).body.data)
      .toMatchObject([{ activity_id: activity.id, activity: { title: activity.title } }]);
    await api("get", rosterPath, student).expect(403);
    const roster = await api("get", rosterPath, founder).expect(200);
    expect(roster.body.data).toMatchObject([{ user: { id: student.id, student_id: student.student_id } }]);
    expect(roster.body.data[0].user).not.toHaveProperty("email");
    await api("delete", endpoint, otherStudent).expect(200);
    await api("put", endpoint, otherStudent).expect(409);
    await api("delete", endpoint, student).expect(200);
    await api("delete", endpoint, student).expect(200);
    await api("put", endpoint, otherStudent).expect(200);
    expect((await api("get", "/api/business/my-registrations", student).expect(200)).body.data).toEqual([]);
  });

  test("rejects closed, past, and other-campus activities", async () => {
    const activities = await Promise.all([
      makeActivity({ registration_capacity: null }),
      makeActivity({ status: "draft" }),
      makeActivity({ start_time: new Date(Date.now() - 86400000) }),
    ]);
    expect((await api("get", "/api/public/activities").expect(200)).body.data).toEqual([]);
    for (const activity of activities) {
      const closed = await api("put", `/api/business/activities/${activity.id}/registration`, student).expect(409);
      expect(closed.body.code).toBe("REGISTRATION_CLOSED");
    }

    const activity = await makeActivity();
    const otherCampus = await createTenant({ code: "tenant-b" });
    await addTenantMembership(otherCampus, student);
    await api("put", `/api/business/activities/${activity.id}/registration`, student, otherCampus).expect(404);
    await api("put", `/api/business/activities/${activity.id}/registration`, student).expect(200);
    await activity.update({ start_time: new Date(Date.now() - 86400000) });
    await api("delete", `/api/business/activities/${activity.id}/registration`, student).expect(409);
  });

  test("a different administrator must review, and rejection requires a reason", async () => {
    await db.TenantMembership.update({ role: "tenant_admin" }, { where: { tenant_id: tenant.id, user_id: founder.id } });
    const { user: reviewer } = await createUser();
    await addTenantMembership(tenant, reviewer, "tenant_admin");
    const activity = await makeActivity({ status: "draft" });
    const endpoint = `/api/business/activities/${activity.id}`;
    const submitted = await api("post", `${endpoint}/submit-approval`, founder).send({}).expect(200);
    expect(submitted.body.data.approval.approver_id).toBe(reviewer.id);
    const decision = `/api/business/approvals/${submitted.body.data.approval.id}/decision`;
    await api("get", "/api/business/approvals/pending", student).expect(403);
    await api("post", decision, founder).send({ decision: "approve" }).expect(403);
    await api("post", decision, reviewer).send({ decision: "reject", comments: " " }).expect(400);
    await api("post", decision, reviewer).send({ decision: "reject", comments: "请补充活动安排" }).expect(200);
    const detail = await api("get", endpoint, founder).expect(200);
    expect(detail.body.data).toMatchObject({ status: "rejected", review_comment: "请补充活动安排" });
  });

  test("an organizer cancellation preserves registrations and creates a per-student notice", async () => {
    const activity = await makeActivity();
    const endpoint = `/api/business/activities/${activity.id}`;
    await api("put", `${endpoint}/registration`, student).expect(200);
    await api("post", `${endpoint}/cancel`, otherStudent).send({ reason: "换场地" }).expect(403);
    await api("post", `${endpoint}/cancel`, founder).send({ reason: " " }).expect(400);
    await api("post", `${endpoint}/cancel`, founder).send({ reason: "场馆临时关闭" }).expect(200);
    expect((await api("get", "/api/public/activities").expect(200)).body.data).toEqual([]);
    await api("put", `${endpoint}/registration`, otherStudent).expect(409);
    await api("delete", endpoint, founder).expect(409);
    const registrations = await api("get", "/api/business/my-registrations", student).expect(200);
    expect(registrations.body.data).toMatchObject([{
      cancellation_read_at: null, activity: { status: "cancelled", cancellation_reason: "场馆临时关闭" },
    }]);
    const notice = `${endpoint}/registration/cancellation-read`;
    await api("patch", notice, otherStudent).expect(404);
    const read = await api("patch", notice, student).expect(200);
    const retry = await api("patch", notice, student).expect(200);
    expect(read.body.data.cancellation_read_at).toBeTruthy();
    expect(retry.body.data).toEqual(read.body.data);
  });

  test("attendance uses the registered roster and becomes read-only after completion", async () => {
    const activity = await makeActivity({ end_time: new Date(Date.now() + 90000000) });
    const endpoint = `/api/business/activities/${activity.id}`;
    const attendance = `${endpoint}/registrations/${student.id}/attendance`;
    await api("put", `${endpoint}/registration`, student).expect(200);
    await api("put", attendance, founder).send({ checked_in: true }).expect(409);
    await api("patch", endpoint, founder).send({ status: "completed" }).expect(409);
    await activity.update({ start_time: new Date(Date.now() - 3600000) });
    await api("put", attendance, student).send({ checked_in: true }).expect(403);
    await api("put", `${endpoint}/registrations/${otherStudent.id}/attendance`, founder).send({ checked_in: true }).expect(404);
    const signed = await api("put", attendance, founder).send({ checked_in: true }).expect(200);
    expect(signed.body.data.checked_in_at).toBeTruthy();
    const undo = await api("put", attendance, founder).send({ checked_in: false }).expect(200);
    expect(undo.body.data.checked_in_at).toBeNull();
    await api("put", attendance, founder).send({ checked_in: true }).expect(200);
    await activity.update({ end_time: new Date(Date.now() - 1000) });
    await api("patch", endpoint, founder).send({ status: "completed" }).expect(200);
    await api("put", attendance, founder).send({ checked_in: false }).expect(409);
    const roster = await api("get", `${endpoint}/registrations`, founder).expect(200);
    expect(roster.body.data[0].checked_in_at).toBeTruthy();
  });
});
