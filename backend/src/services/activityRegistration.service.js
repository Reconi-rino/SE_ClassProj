const { Op } = require("sequelize");
const { sequelize, Activity, ActivityRegistration, Club, User } = require("../models");
const { ensureActivity, ensureCanManageClub, lockActivity } = require("./activity.service");
const { ApiError } = require("../utils/common");

const activityFields = [
  "id", "club_id", "title", "description", "start_time", "end_time", "location",
  "status", "registration_capacity",
];

function includeClub(tenantId, activeOnly = false) {
  return {
    model: Club,
    as: "club",
    attributes: ["id", "name"],
    where: { tenant_id: tenantId, ...(activeOnly ? { status: "active" } : {}) },
  };
}

async function listOpenActivities({ tenantId, clubId }) {
  const activities = await Activity.findAll({
    where: {
      tenant_id: tenantId,
      status: "approved",
      registration_capacity: { [Op.gt]: 0 },
      start_time: { [Op.gt]: new Date() },
      ...(clubId ? { club_id: clubId } : {}),
    },
    attributes: activityFields,
    include: [includeClub(tenantId, true)],
    order: [["start_time", "ASC"], ["id", "ASC"]],
  });
  if (!activities.length) return [];

  const counts = await ActivityRegistration.findAll({
    where: { tenant_id: tenantId, activity_id: activities.map((activity) => activity.id) },
    attributes: ["activity_id", [sequelize.fn("COUNT", sequelize.col("activity_id")), "total"]],
    group: ["activity_id"],
    raw: true,
  });
  const countByActivity = new Map(counts.map((row) => [row.activity_id, Number(row.total)]));
  return activities.map((activity) => ({
    ...activity.toJSON(),
    remaining_places: Math.max(0, activity.registration_capacity - (countByActivity.get(activity.id) || 0)),
  }));
}

async function listMyRegistrations({ tenantId, actorUserId }) {
  return ActivityRegistration.findAll({
    where: { tenant_id: tenantId, user_id: actorUserId },
    attributes: ["activity_id", "created_at", "checked_in_at", "cancellation_read_at"],
    include: [{
      model: Activity,
      as: "activity",
      where: { tenant_id: tenantId },
      attributes: [...activityFields, "cancellation_reason", "cancelled_at"],
      include: [includeClub(tenantId)],
    }],
    order: [[{ model: Activity, as: "activity" }, "start_time", "ASC"], ["activity_id", "ASC"]],
  });
}

function registrationIsOpen(activity) {
  return activity.status === "approved" && activity.registration_capacity > 0 &&
    activity.start_time.getTime() > Date.now();
}

async function changeRegistration({ tenantId, actorUserId, activityId }, register) {
  return sequelize.transaction(async (transaction) => {
    // A row lock serializes signup and cancellation for the same activity on MySQL.
    const activity = await lockActivity(tenantId, activityId, transaction);

    const where = { tenant_id: tenantId, activity_id: activityId, user_id: actorUserId };
    const existing = await ActivityRegistration.findOne({ where, transaction });
    if (register && existing) return existing;
    if (!register && !existing) return;

    if (!registrationIsOpen(activity)) {
      throw new ApiError(409, "REGISTRATION_CLOSED", "该活动的报名和取消报名已关闭。");
    }
    if (!register) {
      await existing.destroy({ transaction });
      return;
    }

    const club = await Club.findOne({
      where: { id: activity.club_id, tenant_id: tenantId, status: "active" },
      transaction,
    });
    if (!club) {
      throw new ApiError(409, "REGISTRATION_CLOSED", "该活动的报名已关闭。");
    }
    const total = await ActivityRegistration.count({
      where: { tenant_id: tenantId, activity_id: activityId },
      transaction,
    });
    if (total >= activity.registration_capacity) {
      throw new ApiError(409, "ACTIVITY_FULL", "活动名额已满。");
    }
    return ActivityRegistration.create(where, { transaction });
  });
}

async function listRoster({ tenantId, actorUserId, activityId }) {
  const activity = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, activity.club);
  return ActivityRegistration.findAll({
    where: { tenant_id: tenantId, activity_id: activity.id },
    attributes: ["created_at", "checked_in_at"],
    include: [{ model: User, as: "user", attributes: ["id", "username", "student_id"] }],
    order: [["created_at", "ASC"], ["user_id", "ASC"]],
  });
}

async function cancelActivity({ tenantId, actorUserId, activityId, reason }) {
  const details = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, details.club);
  return sequelize.transaction(async (transaction) => {
    const activity = await lockActivity(tenantId, details.id, transaction);
    if (activity.status === "cancelled" && activity.cancellation_reason === reason) return activity;
    if (activity.status !== "approved" || activity.start_time.getTime() <= Date.now()) {
      throw new ApiError(409, "ACTIVITY_NOT_CANCELLABLE", "只能取消已通过审批且尚未开始的活动。");
    }
    return activity.update({ status: "cancelled", cancellation_reason: reason, cancelled_at: new Date() }, { transaction });
  });
}

async function readCancellation({ tenantId, actorUserId, activityId }) {
  const activity = await Activity.findOne({ where: { id: activityId, tenant_id: tenantId, status: "cancelled" } });
  const where = { tenant_id: tenantId, activity_id: activityId, user_id: actorUserId };
  const registration = activity && await ActivityRegistration.findOne({ where });
  if (!registration) throw new ApiError(404, "ACTIVITY_NOTICE_NOT_FOUND", "取消通知不存在。");
  await ActivityRegistration.update({ cancellation_read_at: new Date() }, {
    where: { ...where, cancellation_read_at: null },
  });
  return { cancellation_read_at: (await registration.reload()).cancellation_read_at };
}

async function setAttendance({ tenantId, actorUserId, activityId, studentId, checkedIn }) {
  const details = await ensureActivity(tenantId, activityId);
  await ensureCanManageClub(tenantId, actorUserId, details.club);
  return sequelize.transaction(async (transaction) => {
    const activity = await lockActivity(tenantId, details.id, transaction);
    if (activity.status !== "approved" || activity.start_time.getTime() > Date.now()) {
      throw new ApiError(409, "ATTENDANCE_CLOSED", "签到从活动开始开放，结项后关闭。");
    }
    const registration = await ActivityRegistration.findOne({
      where: { tenant_id: tenantId, activity_id: activity.id, user_id: studentId },
      transaction,
    });
    if (!registration) throw new ApiError(404, "REGISTRATION_NOT_FOUND", "该学生没有报名此活动。");
    const checkedInAt = checkedIn ? registration.checked_in_at || new Date() : null;
    await registration.update({ checked_in_at: checkedInAt }, { transaction });
    return { user_id: studentId, checked_in_at: registration.checked_in_at };
  });
}

module.exports = {
  listOpenActivities, listMyRegistrations, changeRegistration, listRoster,
  cancelActivity, readCancellation, setAttendance,
};
