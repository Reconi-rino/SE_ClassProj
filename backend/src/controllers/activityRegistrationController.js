const service = require("../services/activityRegistration.service");
const { handleServiceError, handleRequestValidation } = require("../utils/errorResponse");

function respond(getData) {
  return async (req, res, next) => {
    if (!handleRequestValidation(req, res)) return;
    try {
      const data = await getData({
        tenantId: req.tenant.id,
        actorUserId: req.user?.id,
        activityId: Number(req.params.id),
        clubId: req.query.club_id,
        studentId: Number(req.params.userId),
        checkedIn: req.body?.checked_in,
        reason: req.body?.reason,
      });
      return res.json({ success: true, data: data ?? null });
    } catch (error) {
      return handleServiceError(error, res, next);
    }
  };
}

module.exports = {
  listOpenActivities: respond(service.listOpenActivities),
  listMyRegistrations: respond(service.listMyRegistrations),
  register: respond((context) => service.changeRegistration(context, true)),
  cancel: respond((context) => service.changeRegistration(context, false)),
  listRoster: respond(service.listRoster),
  cancelActivity: respond(service.cancelActivity),
  readCancellation: respond(service.readCancellation),
  setAttendance: respond(service.setAttendance),
};
