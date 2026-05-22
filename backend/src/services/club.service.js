const { Op } = require("sequelize");
const { sequelize, Club, ClubMember, TenantMembership, User } = require("../models");
const { ApiError, parsePositiveInt } = require("../utils/common");

async function ensureClub(tenantId, clubId) {
  const id = parsePositiveInt(clubId);
  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "club id must be a positive integer.");
  }

  const club = await Club.findOne({
    where: {
      tenant_id: tenantId,
      id,
    },
  });

  if (!club) {
    throw new ApiError(404, "CLUB_NOT_FOUND", "Club not found.");
  }

  return club;
}

async function ensureTenantMembership(tenantId, userId) {
  const user = await User.findByPk(userId);
  if (user && (user.role === "system_admin" || user.role === "platform_admin")) {
    return { role: "tenant_admin" }; // Global admins bypass this check
  }

  const membership = await TenantMembership.findOne({
    where: {
      tenant_id: tenantId,
      user_id: userId,
    },
  });

  if (!membership) {
    throw new ApiError(403, "TENANT_MEMBERSHIP_REQUIRED", "User is not a member of this tenant.");
  }

  return membership;
}

async function ensureUserExists(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
  }
  return user;
}

async function listClubs({ tenantId, status, keyword }) {
  const where = { tenant_id: tenantId };

  if (status) {
    where.status = status;
  }

  if (keyword) {
    where.name = {
      [Op.like]: `%${keyword}%`,
    };
  }

  return Club.findAll({
    where,
    include: [
      {
        model: User,
        as: "founder",
        attributes: ["id", "username", "email", "student_id"],
      },
    ],
    order: [["id", "DESC"]],
  });
}

async function getClub({ tenantId, clubId }) {
  const club = await ensureClub(tenantId, clubId);
  return Club.findOne({
    where: {
      tenant_id: tenantId,
      id: club.id,
    },
    include: [
      {
        model: User,
        as: "founder",
        attributes: ["id", "username", "email", "student_id"],
      },
    ],
  });
}

async function createClub({ tenantId, actorUserId, payload }) {
  const founderId = parsePositiveInt(payload.founder_id) || actorUserId;
  await ensureUserExists(founderId);
  await ensureTenantMembership(tenantId, founderId);

  const transaction = await sequelize.transaction();
  try {
    const club = await Club.create(
      {
        tenant_id: tenantId,
        name: payload.name,
        description: payload.description || null,
        founder_id: founderId,
        status: payload.status || "active",
      },
      { transaction }
    );

    await ClubMember.findOrCreate({
      where: {
        tenant_id: tenantId,
        club_id: club.id,
        user_id: founderId,
      },
      defaults: {
        role: "founder",
        joined_at: new Date(),
      },
      transaction,
    });

    await transaction.commit();
    return getClub({ tenantId, clubId: club.id });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateClub({ tenantId, clubId, payload }) {
  const club = await ensureClub(tenantId, clubId);

  const updates = {};
  if (typeof payload.name !== "undefined") {
    updates.name = payload.name;
  }
  if (typeof payload.description !== "undefined") {
    updates.description = payload.description;
  }
  if (typeof payload.status !== "undefined") {
    updates.status = payload.status;
  }
  if (typeof payload.cover_image_url !== "undefined") {
    updates.cover_image_url = payload.cover_image_url || null;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "No updatable fields provided.");
  }

  await club.update(updates);
  return getClub({ tenantId, clubId: club.id });
}

async function deleteClub({ tenantId, clubId }) {
  const club = await ensureClub(tenantId, clubId);
  await club.destroy();
}

async function listClubMembers({ tenantId, clubId }) {
  const club = await ensureClub(tenantId, clubId);

  const members = await ClubMember.findAll({
    where: {
      tenant_id: tenantId,
      club_id: club.id,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "username", "email", "student_id", "role"],
      },
    ],
    order: [["id", "ASC"]],
  });

  return {
    club,
    members,
  };
}

async function joinClub({ tenantId, clubId, userId }) {
  const club = await ensureClub(tenantId, clubId);
  if (club.status !== "active") {
    throw new ApiError(409, "CLUB_NOT_JOINABLE", "Only active clubs can be joined.");
  }

  await ensureTenantMembership(tenantId, userId);

  const existing = await ClubMember.findOne({
    where: {
      tenant_id: tenantId,
      club_id: club.id,
      user_id: userId,
    },
  });

  if (existing) {
    throw new ApiError(409, "ALREADY_CLUB_MEMBER", "User is already a club member.");
  }

  return ClubMember.create({
    tenant_id: tenantId,
    club_id: club.id,
    user_id: userId,
    role: "member",
    joined_at: new Date(),
  });
}

async function leaveClub({ tenantId, clubId, userId }) {
  const club = await ensureClub(tenantId, clubId);

  const membership = await ClubMember.findOne({
    where: {
      tenant_id: tenantId,
      club_id: club.id,
      user_id: userId,
    },
  });

  if (!membership) {
    throw new ApiError(404, "CLUB_MEMBER_NOT_FOUND", "Club membership not found.");
  }

  if (membership.role === "founder") {
    throw new ApiError(400, "FOUNDER_CANNOT_LEAVE", "Founder cannot leave the club.");
  }

  await membership.destroy();
}

async function updateClubMemberRole({ tenantId, clubId, memberId, role }) {
  const club = await ensureClub(tenantId, clubId);

  const id = parsePositiveInt(memberId);
  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "member id must be a positive integer.");
  }

  const membership = await ClubMember.findOne({
    where: {
      id,
      tenant_id: tenantId,
      club_id: club.id,
    },
  });

  if (!membership) {
    throw new ApiError(404, "CLUB_MEMBER_NOT_FOUND", "Club member not found.");
  }

  if (membership.role === "founder") {
    throw new ApiError(400, "FOUNDER_ROLE_IMMUTABLE", "Founder role cannot be changed.");
  }

  await membership.update({ role });
  return ClubMember.findOne({
    where: {
      id: membership.id,
      tenant_id: tenantId,
      club_id: club.id,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "username", "email", "student_id", "role"],
      },
    ],
  });
}

async function removeClubMember({ tenantId, clubId, memberId }) {
  const club = await ensureClub(tenantId, clubId);

  const id = parsePositiveInt(memberId);
  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "member id must be a positive integer.");
  }

  const membership = await ClubMember.findOne({
    where: {
      id,
      tenant_id: tenantId,
      club_id: club.id,
    },
  });

  if (!membership) {
    throw new ApiError(404, "CLUB_MEMBER_NOT_FOUND", "Club member not found.");
  }

  if (membership.role === "founder") {
    throw new ApiError(400, "FOUNDER_CANNOT_BE_REMOVED", "Founder cannot be removed from club.");
  }

  await membership.destroy();
}

module.exports = {
  ApiError,
  listClubs,
  getClub,
  createClub,
  updateClub,
  deleteClub,
  listClubMembers,
  joinClub,
  leaveClub,
  updateClubMemberRole,
  removeClubMember,
};
