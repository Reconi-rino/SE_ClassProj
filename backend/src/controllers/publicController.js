const { Club, User, ClubMember, Activity } = require("../models");
const { Sequelize } = require("sequelize");

async function listPublicClubs(req, res, next) {
  try {
    const tenantId = req.tenant ? req.tenant.id : 1;

    const clubs = await Club.findAll({
      where: { tenant_id: tenantId, status: "active" },
      order: [["id", "DESC"]],
      include: [
        { model: User, as: "founder", attributes: ["id", "username"] },
      ],
    });

    const clubIds = clubs.map((c) => c.id);

    const memberCounts = await ClubMember.findAll({
      where: { tenant_id: tenantId, club_id: { [Sequelize.Op.in]: clubIds } },
      attributes: ["club_id", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
      group: ["club_id"],
    });

    const activityCounts = await Activity.findAll({
      where: { tenant_id: tenantId, club_id: { [Sequelize.Op.in]: clubIds } },
      attributes: ["club_id", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
      group: ["club_id"],
    });

    const memberMap = {};
    memberCounts.forEach((m) => { memberMap[m.club_id] = Number(m.get("count")); });
    const activityMap = {};
    activityCounts.forEach((a) => { activityMap[a.club_id] = Number(a.get("count")); });

    const data = clubs.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      cover_image_url: c.cover_image_url,
      founder: c.founder ? { id: c.founder.id, username: c.founder.username } : null,
      member_count: memberMap[c.id] || 0,
      activity_count: activityMap[c.id] || 0,
      created_at: c.created_at,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function getPublicClub(req, res, next) {
  try {
    const tenantId = req.tenant ? req.tenant.id : 1;
    const club = await Club.findOne({
      where: { tenant_id: tenantId, id: req.params.id, status: "active" },
      include: [
        { model: User, as: "founder", attributes: ["id", "username"] },
      ],
    });
    if (!club) {
      return res.status(404).json({ success: false, message: "Club not found." });
    }

    const [memberCount, activityCount, recentActivities] = await Promise.all([
      ClubMember.count({ where: { tenant_id: tenantId, club_id: club.id } }),
      Activity.count({ where: { tenant_id: tenantId, club_id: club.id } }),
      Activity.findAll({
        where: { tenant_id: tenantId, club_id: club.id },
        order: [["start_time", "DESC"]],
        limit: 5,
        attributes: ["id", "title", "status", "start_time", "location"],
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        id: club.id,
        name: club.name,
        description: club.description,
        cover_image_url: club.cover_image_url,
        founder: club.founder ? { id: club.founder.id, username: club.founder.username } : null,
        member_count: memberCount,
        activity_count: activityCount,
        recent_activities: recentActivities,
        created_at: club.created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listPublicClubs, getPublicClub };
