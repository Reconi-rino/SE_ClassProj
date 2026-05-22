const { TenantMembership, FinancialRecord, Activity, Approval, Club, ClubMember, ClubTask } = require("../models");
const { parsePositiveInt } = require("../utils/common");

async function resolveTenantMembership(req) {
  const id = parsePositiveInt(req.params && req.params.id);
  if (!id) return null;
  return TenantMembership.findByPk(id);
}

async function resolveClub(req) {
  const id = parsePositiveInt(req.params && req.params.id);
  if (!id) return null;
  return Club.findByPk(id);
}

async function resolveClubMember(req) {
  const memberId = parsePositiveInt(req.params && req.params.memberId);
  if (!memberId) return null;
  return ClubMember.findByPk(memberId);
}

async function resolveClubFromActivity(req) {
  const activityId = parsePositiveInt(req.params && req.params.id);
  if (activityId) {
    const activity = await Activity.findByPk(activityId);
    if (activity) return Club.findByPk(activity.club_id);
    return null;
  }
  const clubId = parsePositiveInt(req.body && req.body.club_id);
  if (clubId) return Club.findByPk(clubId);
  return null;
}

async function resolveClubFromApproval(req) {
  const approvalId = parsePositiveInt(req.params && req.params.id);
  if (approvalId) {
    const approval = await Approval.findByPk(approvalId);
    if (approval) {
      const activity = await Activity.findByPk(approval.activity_id);
      if (activity) return Club.findByPk(activity.club_id);
    }
    return null;
  }
  return null;
}

async function resolveClubFromFinancialRecord(req) {
  const recordId = parsePositiveInt(req.params && req.params.id);
  if (recordId) {
    const record = await FinancialRecord.findByPk(recordId);
    if (record) return Club.findByPk(record.club_id);
    return null;
  }
  const clubId = parsePositiveInt(req.body && req.body.club_id);
  if (clubId) return Club.findByPk(clubId);
  return null;
}

async function resolveScopedClubForResource(resource, req) {
  if (resource === "club") return resolveClub(req);
  if (resource === "club_member") {
    const clubId = parsePositiveInt(req.params && req.params.id);
    if (clubId) return Club.findByPk(clubId);
    return null;
  }
  if (resource === "activity" || resource === "approval") {
    return resolveClubFromActivity(req);
  }
  if (resource === "financial_record") {
    return resolveClubFromFinancialRecord(req);
  }
  return null;
}

async function resolvePolicyResource(resource, req) {
  if (resource === "tenant_membership") return resolveTenantMembership(req);
  if (resource === "club") return resolveClub(req);
  if (resource === "club_member") return resolveClubMember(req);
  if (resource === "activity") {
    const id = parsePositiveInt(req.params && req.params.id);
    if (!id) return null;
    return Activity.findByPk(id);
  }
  if (resource === "approval") {
    const id = parsePositiveInt(req.params && req.params.id);
    if (!id) return null;
    return Approval.findByPk(id);
  }
  if (resource === "financial_record") {
    const id = parsePositiveInt(req.params && req.params.id);
    if (!id) return null;
    return FinancialRecord.findByPk(id);
  }
  if (resource === "club_task") {
    const id = parsePositiveInt(req.params && req.params.id);
    if (!id) return null;
    return ClubTask.findByPk(id);
  }
  return null;
}

module.exports = {
  resolvePolicyResource,
  resolveScopedClubForResource,
};
