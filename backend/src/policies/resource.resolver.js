const { TenantMembership, FinancialRecord, Activity, Approval, Club, ClubMember } = require("../models");

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

async function resolveTenantMembership(req) {
  const id = parsePositiveInt(req.params && req.params.id);
  if (!id) {
    return null;
  }
  return TenantMembership.findByPk(id);
}

async function resolveClub(req) {
  const id = parsePositiveInt(req.params && req.params.id);
  if (!id) {
    return null;
  }
  return Club.findByPk(id);
}

async function resolveClubMember(req) {
  const memberId = parsePositiveInt(req.params && req.params.memberId);
  if (!memberId) {
    return null;
  }
  return ClubMember.findByPk(memberId);
}

async function resolvePolicyResource(resource, req) {
  if (resource === "tenant_membership") {
    return resolveTenantMembership(req);
  }
  if (resource === "club") {
    return resolveClub(req);
  }
  if (resource === "club_member") {
    return resolveClubMember(req);
  }
  if (resource === "activity") {
    const id = parsePositiveInt(req.params && req.params.id);
    if (!id) {
      return null;
    }
    return Activity.findByPk(id);
  }
  if (resource === "approval") {
    const id = parsePositiveInt(req.params && req.params.id);
    if (!id) {
      return null;
    }
    return Approval.findByPk(id);
  }
  if (resource === "financial_record") {
    const id = parsePositiveInt(req.params && req.params.id);
    if (!id) {
      return null;
    }
    return FinancialRecord.findByPk(id);
  }
  return null;
}

module.exports = {
  resolvePolicyResource,
};
