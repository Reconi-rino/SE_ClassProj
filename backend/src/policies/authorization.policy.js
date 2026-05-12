const { TenantMembership, ClubMember, Club } = require("../models");
const { resolvePolicyResource } = require("./resource.resolver");

const ROLE_ALIASES = {
  student: "member",
};

const GLOBAL_PRIVILEGED_ROLES = new Set(["platform_admin", "system_admin"]);

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
      allowClubAdmin: true,
      allowClubRoles: ["founder", "admin"],
    },
    delete: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
      allowClubAdmin: true,
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
      allowClubAdmin: true,
      allowClubRoles: ["founder", "admin"],
      forbidAssignRoles: ["founder"],
    },
    remove: {
      allowTenantRoles: ["tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
      allowClubAdmin: true,
      allowClubRoles: ["founder", "admin"],
    },
  },
  financial_record: {
    read: {
      allowTenantRoles: ["member", "tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    create: {
      allowTenantRoles: ["member", "tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    update: {
      allowTenantRoles: ["member", "tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
    delete: {
      allowTenantRoles: ["member", "tenant_admin"],
      allowGlobalRoles: ["system_admin", "platform_admin", "club_admin"],
    },
  },
  activity: {
    read: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    create: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    update: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    delete: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
    },
    submit_approval: {
      allowTenantRoles: ["tenant_admin", "member"],
      allowGlobalRoles: ["system_admin", "platform_admin"],
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
};

function roleMatches(role, allowedRoles) {
  if (!role || !Array.isArray(allowedRoles)) {
    return false;
  }
  return allowedRoles.includes(role);
}

function normalizeGlobalRole(role) {
  if (!role) {
    return null;
  }
  return ROLE_ALIASES[role] || role;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

async function resolveTenantRole(req) {
  if (!req.user || !req.tenant || !Number.isInteger(req.tenant.id)) {
    return null;
  }

  const membership = await TenantMembership.findOne({
    where: {
      tenant_id: req.tenant.id,
      user_id: req.user.id,
    },
  });

  if (!membership) {
    return null;
  }

  return membership.role;
}

async function resolveScopedClub(req) {
  const id = parsePositiveInt(req.params && req.params.id);
  if (!id) {
    return null;
  }

  return Club.findByPk(id);
}

async function resolveActorClubRole(req, clubId) {
  if (!req.user || !Number.isInteger(clubId) || !req.tenant) {
    return null;
  }

  const membership = await ClubMember.findOne({
    where: {
      tenant_id: req.tenant.id,
      club_id: clubId,
      user_id: req.user.id,
    },
  });

  return membership ? membership.role : null;
}

async function evaluatePolicy({ action, resource, req }) {
  const resourcePolicy = POLICY[resource] || {};
  const actionPolicy = resourcePolicy[action];

  if (!actionPolicy) {
    return {
      allowed: false,
      reason: "No explicit policy rule for action/resource.",
    };
  }

  const user = req.user;
  if (!user) {
    return {
      allowed: false,
      reason: "Unauthenticated.",
    };
  }

  if (!req.tenant) {
    return {
      allowed: false,
      reason: "Tenant context required by policy.",
    };
  }

  const actorGlobalRole = normalizeGlobalRole(user.role);
  const actorTenantRole = await resolveTenantRole(req);

  const actorPrivileged = GLOBAL_PRIVILEGED_ROLES.has(actorGlobalRole);
  const allowedByGlobalRole = roleMatches(actorGlobalRole, actionPolicy.allowGlobalRoles);
  const allowedByTenantRole = roleMatches(actorTenantRole, actionPolicy.allowTenantRoles);

  let scopedClub = null;
  if (resource === "club" || resource === "club_member") {
    scopedClub = await resolveScopedClub(req);
    if (scopedClub && Number.isInteger(scopedClub.tenant_id) && scopedClub.tenant_id !== req.tenant.id) {
      return {
        allowed: false,
        reason: "Cross-tenant resource access denied.",
      };
    }
  }

  let actorClubRole = null;
  let allowedByClubAdminScope = false;
  if (actionPolicy.allowClubAdmin && actorGlobalRole === "club_admin" && scopedClub) {
    actorClubRole = await resolveActorClubRole(req, scopedClub.id);
    allowedByClubAdminScope = roleMatches(actorClubRole, actionPolicy.allowClubRoles);
  }

  if (!actorPrivileged && !allowedByGlobalRole && !allowedByTenantRole && !allowedByClubAdminScope) {
    return {
      allowed: false,
      reason: "Role not allowed for action.",
    };
  }

  const targetResource = await resolvePolicyResource(resource, req);
  if (targetResource && Number.isInteger(targetResource.tenant_id) && targetResource.tenant_id !== req.tenant.id) {
    return {
      allowed: false,
      reason: "Cross-tenant resource access denied.",
    };
  }

  if (action === "update_role") {
    const requestedRole = req.body && req.body.role;
    if (requestedRole && actionPolicy.forbidAssignRoles && actionPolicy.forbidAssignRoles.includes(requestedRole)) {
      return {
        allowed: false,
        reason: "Requested role assignment is forbidden.",
      };
    }
  }

  return {
    allowed: true,
    context: {
      actorGlobalRole,
      actorTenantRole,
      actorClubRole,
    },
  };
}

module.exports = {
  evaluatePolicy,
};
