const { syncTestDatabase, db } = require("../helpers/testDb");
const { createTenant, createUser, addTenantMembership, createClub } = require("../helpers/testData");
const clubService = require("../../src/services/club.service");

describe("club.service", () => {
  let tenant, founder, member, nonMember;

  beforeEach(async () => {
    await syncTestDatabase();
    tenant = await createTenant();
    const f = await createUser({ username: "founder_user", email: "founder@test.local", role: "student" });
    founder = f.user;
    await addTenantMembership(tenant, founder, "member");
    const m = await createUser({ username: "member_user", email: "member@test.local", role: "student" });
    member = m.user;
    await addTenantMembership(tenant, member, "member");
    const nm = await createUser({ username: "outsider", email: "outsider@test.local", role: "student" });
    nonMember = nm.user;
  });

  describe("listClubs", () => {
    test("returns clubs in tenant", async () => {
      await createClub({ tenant, founder, name: "Chess Club" });
      await createClub({ tenant, founder, name: "Art Club" });
      const clubs = await clubService.listClubs({ tenantId: tenant.id, status: null, keyword: null });
      expect(clubs).toHaveLength(2);
      expect(clubs[0].name).toBe("Art Club");
    });

    test("filters by status", async () => {
      await createClub({ tenant, founder, name: "Active Club" });
      const club = await db.Club.create({
        tenant_id: tenant.id, name: "Archived", founder_id: founder.id, status: "inactive",
      });
      const clubs = await clubService.listClubs({ tenantId: tenant.id, status: "active", keyword: null });
      expect(clubs).toHaveLength(1);
      expect(clubs[0].name).toBe("Active Club");
    });

    test("filters by keyword", async () => {
      await createClub({ tenant, founder, name: "Chess Club" });
      await createClub({ tenant, founder, name: "Art Club" });
      const clubs = await clubService.listClubs({ tenantId: tenant.id, status: null, keyword: "chess" });
      expect(clubs).toHaveLength(1);
      expect(clubs[0].name).toBe("Chess Club");
    });
  });

  describe("getClub", () => {
    test("returns club by id", async () => {
      const club = await createClub({ tenant, founder, name: "Chess Club" });
      const result = await clubService.getClub({ tenantId: tenant.id, clubId: club.id });
      expect(result.name).toBe("Chess Club");
      expect(result.founder).toBeDefined();
    });

    test("throws ApiError for non-existent club", async () => {
      await expect(
        clubService.getClub({ tenantId: tenant.id, clubId: 99999 })
      ).rejects.toMatchObject({ name: "ApiError", status: 404, code: "CLUB_NOT_FOUND" });
    });
  });

  describe("createClub", () => {
    test("creates club and founder membership", async () => {
      const club = await clubService.createClub({
        tenantId: tenant.id, actorUserId: founder.id,
        payload: { name: "New Club", description: "Desc" },
      });
      expect(club.name).toBe("New Club");
      const members = await db.ClubMember.findAll({ where: { club_id: club.id } });
      expect(members).toHaveLength(1);
      expect(members[0].role).toBe("founder");
      expect(members[0].user_id).toBe(founder.id);
    });

    test("throws ApiError if founder_id user does not exist", async () => {
      await expect(
        clubService.createClub({ tenantId: tenant.id, actorUserId: founder.id, payload: { name: "X", founder_id: 99999 } })
      ).rejects.toMatchObject({ name: "ApiError", status: 404, code: "USER_NOT_FOUND" });
    });

    test("throws if founder not in tenant", async () => {
      await expect(
        clubService.createClub({ tenantId: tenant.id, actorUserId: founder.id, payload: { name: "X", founder_id: nonMember.id } })
      ).rejects.toMatchObject({ name: "ApiError", code: "TENANT_MEMBERSHIP_REQUIRED" });
    });
  });

  describe("updateClub", () => {
    test("updates club fields", async () => {
      const club = await createClub({ tenant, founder, name: "Old Name" });
      const updated = await clubService.updateClub({ tenantId: tenant.id, clubId: club.id, payload: { name: "New Name" } });
      expect(updated.name).toBe("New Name");
    });

    test("throws ApiError for non-existent club", async () => {
      await expect(
        clubService.updateClub({ tenantId: tenant.id, clubId: 99999, payload: { name: "X" } })
      ).rejects.toMatchObject({ name: "ApiError", status: 404 });
    });
  });

  describe("deleteClub", () => {
    test("deletes club", async () => {
      const club = await createClub({ tenant, founder, name: "To Delete" });
      await clubService.deleteClub({ tenantId: tenant.id, clubId: club.id });
      const found = await db.Club.findByPk(club.id);
      expect(found).toBeNull();
    });
  });

  describe("joinClub / leaveClub", () => {
    test("member can join active club", async () => {
      const club = await createClub({ tenant, founder });
      const membership = await clubService.joinClub({ tenantId: tenant.id, clubId: club.id, userId: member.id });
      expect(membership.role).toBe("member");
    });

    test("throws for non-active club", async () => {
      const club = await db.Club.create({
        tenant_id: tenant.id, name: "Inactive", founder_id: founder.id, status: "inactive",
      });
      await expect(
        clubService.joinClub({ tenantId: tenant.id, clubId: club.id, userId: member.id })
      ).rejects.toMatchObject({ name: "ApiError", code: "CLUB_NOT_JOINABLE" });
    });

    test("throws for duplicate join", async () => {
      const club = await createClub({ tenant, founder });
      await clubService.joinClub({ tenantId: tenant.id, clubId: club.id, userId: member.id });
      await expect(
        clubService.joinClub({ tenantId: tenant.id, clubId: club.id, userId: member.id })
      ).rejects.toMatchObject({ name: "ApiError", code: "ALREADY_CLUB_MEMBER" });
    });

    test("member can leave club", async () => {
      const club = await createClub({ tenant, founder });
      const membership = await clubService.joinClub({ tenantId: tenant.id, clubId: club.id, userId: member.id });
      await clubService.leaveClub({ tenantId: tenant.id, clubId: club.id, userId: member.id });
      const found = await db.ClubMember.findByPk(membership.id);
      expect(found).toBeNull();
    });

    test("founder cannot leave", async () => {
      const club = await createClub({ tenant, founder });
      await expect(
        clubService.leaveClub({ tenantId: tenant.id, clubId: club.id, userId: founder.id })
      ).rejects.toMatchObject({ name: "ApiError", code: "FOUNDER_CANNOT_LEAVE" });
    });
  });

  describe("updateClubMemberRole", () => {
    test("updates member role to admin", async () => {
      const club = await createClub({ tenant, founder });
      const membership = await clubService.joinClub({ tenantId: tenant.id, clubId: club.id, userId: member.id });
      const updated = await clubService.updateClubMemberRole({
        tenantId: tenant.id, clubId: club.id, memberId: membership.id, role: "admin",
      });
      expect(updated.role).toBe("admin");
    });

    test("throws for non-existent member", async () => {
      const club = await createClub({ tenant, founder });
      await expect(
        clubService.updateClubMemberRole({ tenantId: tenant.id, clubId: club.id, memberId: 99999, role: "admin" })
      ).rejects.toMatchObject({ name: "ApiError", code: "CLUB_MEMBER_NOT_FOUND" });
    });
  });

  describe("removeClubMember", () => {
    test("removes member from club", async () => {
      const club = await createClub({ tenant, founder });
      const membership = await clubService.joinClub({ tenantId: tenant.id, clubId: club.id, userId: member.id });
      await clubService.removeClubMember({ tenantId: tenant.id, clubId: club.id, memberId: membership.id });
      const found = await db.ClubMember.findByPk(membership.id);
      expect(found).toBeNull();
    });
  });
});
