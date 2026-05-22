const { TenantMembership, ClubMember } = require("../models");
const { resolvePolicyResource, resolveScopedClubForResource } = require("./resource.resolver");
const { parsePositiveInt } = require("../utils/common");

const ROLE_ALIASES = {
  student: "member",
};

const GLOBAL_PRIVILEGED_ROLES = new Set(["platform_admin", "system_admin"]);

const CLUB_SCOPED_RESOURCES = new Set(["club", "club_member", "activity", "approval", "financial_record", "club_task"]);

const POLICY = {
  tenant_membership: {
    read: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    create: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    update_role: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
      forbidAssignRoles: ["platform_admin", "system_admin"],
    },
    delete: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
  },
  club: {
    read: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    create: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    update: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
      allowClubRoles: ["founder", "admin"],
    },
    delete: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
      allowClubRoles: ["founder", "admin"],
    },
  },
  club_member: {
    read: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    join: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    leave: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    update_role: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
      allowClubRoles: ["founder", "admin"],
      forbidAssignRoles: ["founder"],
    },
    remove: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
      allowClubRoles: ["founder", "admin"],
    },
  },
  financial_record: {
    read: {
      allowTenantRoles: ["member", "tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    create: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
    update: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
    delete: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
  },
  activity: {
    read: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    create: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
    update: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
    delete: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
    submit_approval: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
  },
  approval: {
    read_pending: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    decide: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
  },
  club_task: {
    read: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    create: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
    update: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
    delete: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
      allowClubRoles: ["founder", "admin"],
    },
  },
  personal_task: {
    read: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    create: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    update: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    delete: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
  },
};

function roleMatches(role, allowedRoles) {
  if (!role || !Array.isArray(allowedRoles)) return false;
  return allowedRoles.includes(role);
}

function normalizeGlobalRole(role) {
  if (!role) return null;
  return ROLE_ALIASES[role] || role;
}

async function resolveTenantRole(req) {
  if (!req.user || !req.tenant || !Number.isInteger(req.tenant.id)) return null;
  const membership = await TenantMembership.findOne({
    where: { tenant_id: req.tenant.id, user_id: req.user.id },
  });
  return membership ? membership.role : null;
}

async function resolveActorClubRole(req, clubId) {
  if (!req.user || !Number.isInteger(clubId) || !req.tenant) return null;
  const membership = await ClubMember.findOne({
    where: { tenant_id: req.tenant.id, club_id: clubId, user_id: req.user.id },
  });
  return membership ? membership.role : null;
}

async function evaluatePolicy({ action, resource, req }) {
  const resourcePolicy = POLICY[resource] || {};
  const actionPolicy = resourcePolicy[action];

  if (!actionPolicy) {
    return { allowed: false, reason: "No explicit policy rule for action/resource." };
  }

  const user = req.user;
  if (!user) {
    return { allowed: false, reason: "Unauthenticated." };
  }

  if (!req.tenant) {
    return { allowed: false, reason: "Tenant context required by policy." };
  }

  const actorGlobalRole = normalizeGlobalRole(user.role);
  const actorTenantRole = await resolveTenantRole(req);

  const actorPrivileged = GLOBAL_PRIVILEGED_ROLES.has(actorGlobalRole);
  const allowedByGlobalRole = roleMatches(actorGlobalRole, actionPolicy.allowGlobalRoles);
  const allowedByTenantRole = roleMatches(actorTenantRole, actionPolicy.allowTenantRoles);

  let scopedClub = null;
  let actorClubRole = null;
  let allowedByClubRole = false;

  if (CLUB_SCOPED_RESOURCES.has(resource) && actionPolicy.allowClubRoles) {
    scopedClub = await resolveScopedClubForResource(resource, req);
    if (scopedClub) {
      if (Number.isInteger(scopedClub.tenant_id) && scopedClub.tenant_id !== req.tenant.id) {
        return { allowed: false, reason: "Cross-tenant resource access denied." };
      }
      actorClubRole = await resolveActorClubRole(req, scopedClub.id);
      allowedByClubRole = roleMatches(actorClubRole, actionPolicy.allowClubRoles);
    }
  }

  if (!actorPrivileged && !allowedByGlobalRole && !allowedByTenantRole && !allowedByClubRole) {
    return { allowed: false, reason: "Role not allowed for action." };
  }

  const targetResource = await resolvePolicyResource(resource, req);
  if (targetResource && Number.isInteger(targetResource.tenant_id) && targetResource.tenant_id !== req.tenant.id) {
    return { allowed: false, reason: "Cross-tenant resource access denied." };
  }

  if (action === "update_role") {
    const requestedRole = req.body && req.body.role;
    if (requestedRole && actionPolicy.forbidAssignRoles && actionPolicy.forbidAssignRoles.includes(requestedRole)) {
      return { allowed: false, reason: "Requested role assignment is forbidden." };
    }
  }

  return {
    allowed: true,
    context: { actorGlobalRole, actorTenantRole, actorClubRole },
  };
}

module.exports = { evaluatePolicy };
