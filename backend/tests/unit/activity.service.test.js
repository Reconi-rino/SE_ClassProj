const { syncTestDatabase, db } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub } = require("../helpers/testData");
const activityService = require("../../src/services/activity.service");

describe("activity.service", () => {
  let tenant, founder, member, nonMember, approver;

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
    const a = await createUser({ username: "approver", email: "approver@test.local", role: "student" });
    approver = a.user;
    await addTenantMembership(tenant, approver, "member");
  });

  async function createActivityForTest(club, overrides = {}) {
    return db.Activity.create({
      tenant_id: tenant.id,
      club_id: club.id,
      title: overrides.title || "Test Activity",
      description: overrides.description || null,
      start_time: overrides.start_time || new Date(),
      end_time: overrides.end_time || null,
      location: overrides.location || null,
      status: overrides.status || "draft",
      created_by: overrides.created_by || founder.id,
    });
  }

  describe("createActivity", () => {
    test("club founder can create activity", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await activityService.createActivity({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { club_id: club.id, title: "New Activity", start_time: new Date() },
      });
      expect(activity.title).toBe("New Activity");
      expect(activity.status).toBe("draft");
      expect(activity.created_by).toBe(founder.id);
    });

    test("non-member cannot create activity", async () => {
      const club = await createClub({ tenant, founder });
      await addTenantMembership(tenant, nonMember, "member");
      await expect(
        activityService.createActivity({ tenantId: tenant.id, actorUserId: nonMember.id, payload: { club_id: club.id, title: "X", start_time: new Date() } })
      ).rejects.toMatchObject({ name: "ApiError", code: "ACTIVITY_OWNERSHIP_DENIED" });
    });

    test("throws for non-existent club", async () => {
      await expect(
        activityService.createActivity({ tenantId: tenant.id, actorUserId: founder.id, payload: { club_id: 99999, title: "X", start_time: new Date() } })
      ).rejects.toMatchObject({ name: "ApiError", code: "CLUB_NOT_FOUND" });
    });
  });

  describe("listActivities", () => {
    test("founder sees their club activities", async () => {
      const club = await createClub({ tenant, founder });
      await createActivityForTest(club, { title: "Activity A" });
      const activities = await activityService.listActivities({
        tenantId: tenant.id, actorUserId: founder.id, status: null, userRole: "student",
      });
      expect(activities).toHaveLength(1);
    });

    test("non-member sees empty list", async () => {
      const club = await createClub({ tenant, founder });
      await createActivityForTest(club);
      await addTenantMembership(tenant, nonMember, "member");
      const activities = await activityService.listActivities({
        tenantId: tenant.id, actorUserId: nonMember.id, status: null, userRole: "student",
      });
      expect(activities).toHaveLength(0);
    });

    test("filters by status", async () => {
      const club = await createClub({ tenant, founder });
      await createActivityForTest(club, { title: "Draft", status: "draft" });
      await createActivityForTest(club, { title: "Approved", status: "approved" });
      const activities = await activityService.listActivities({
        tenantId: tenant.id, actorUserId: founder.id, status: "approved", userRole: "student",
      });
      expect(activities).toHaveLength(1);
      expect(activities[0].title).toBe("Approved");
    });
  });

  describe("getActivityById", () => {
    test("returns activity with club and creator", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club);
      const result = await activityService.getActivityById({ tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id });
      expect(result.title).toBe("Test Activity");
      expect(result.club).toBeDefined();
      expect(result.creator).toBeDefined();
    });

    test("throws for non-existent activity", async () => {
      await expect(
        activityService.getActivityById({ tenantId: tenant.id, actorUserId: founder.id, activityId: 99999 })
      ).rejects.toMatchObject({ name: "ApiError", code: "ACTIVITY_NOT_FOUND" });
    });
  });

  describe("updateActivity", () => {
    test("updates draft activity fields", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "draft" });
      const updated = await activityService.updateActivity({
        tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id,
        payload: { title: "Updated Title" },
      });
      expect(updated.title).toBe("Updated Title");
    });

    test("throws for invalid status transition", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "approved" });
      await expect(
        activityService.updateActivity({
          tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id,
          payload: { status: "draft" },
        })
      ).rejects.toMatchObject({ name: "ApiError", code: "ACTIVITY_STATUS_TRANSITION_INVALID" });
    });

    test("rejected activity can go back to draft", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "rejected" });
      const updated = await activityService.updateActivity({
        tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id,
        payload: { status: "draft" },
      });
      expect(updated.status).toBe("draft");
    });
  });

  describe("deleteActivity", () => {
    test("deletes draft activity", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "draft" });
      await activityService.deleteActivity({ tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id });
      const found = await db.Activity.findByPk(activity.id);
      expect(found).toBeNull();
    });

    test("throws for pending approval activity", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "pending_approval" });
      await expect(
        activityService.deleteActivity({ tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id })
      ).rejects.toMatchObject({ name: "ApiError", code: "ACTIVITY_PENDING_APPROVAL" });
    });
  });

  describe("submitForApproval", () => {
    test("submits draft activity and creates approval", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "draft" });
      const result = await activityService.submitForApproval({
        tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id,
        approverId: approver.id, comments: "Please review",
      });
      expect(result.activity.status).toBe("pending_approval");
      expect(result.approval.status).toBe("pending");
      expect(result.approval.approver_id).toBe(approver.id);
    });

    test("throws for non-draft activity", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "approved" });
      await expect(
        activityService.submitForApproval({
          tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id,
          approverId: approver.id,
        })
      ).rejects.toMatchObject({ name: "ApiError", code: "ACTIVITY_STATUS_TRANSITION_INVALID" });
    });
  });

  describe("decideApproval", () => {
    test("approves pending approval", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "draft" });
      const { approval } = await activityService.submitForApproval({
        tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id, approverId: approver.id,
      });
      const result = await activityService.decideApproval({
        tenantId: tenant.id, actorUserId: approver.id, approvalId: approval.id,
        decision: "approve", comments: "Looks good", userRole: "student",
      });
      expect(result.approval.status).toBe("approved");
      expect(result.activity.status).toBe("approved");
    });

    test("rejects pending approval", async () => {
      const club = await createClub({ tenant, founder });
      const activity = await createActivityForTest(club, { status: "draft" });
      const { approval } = await activityService.submitForApproval({
        tenantId: tenant.id, actorUserId: founder.id, activityId: activity.id, approverId: approver.id,
      });
      const result = await activityService.decideApproval({
        tenantId: tenant.id, actorUserId: approver.id, approvalId: approval.id,
        decision: "reject", comments: "Not good", userRole: "student",
      });
      expect(result.approval.status).toBe("rejected");
      expect(result.activity.status).toBe("rejected");
    });
  });
});
