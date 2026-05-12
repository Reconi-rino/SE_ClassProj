const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db } = require("./testDb");

const SALT_ROUNDS = 10;

async function createTenant(attrs = {}) {
  return db.Tenant.create({
    name: attrs.name || "Tenant A",
    code: attrs.code || "tenant-a",
    status: attrs.status || "active",
  });
}

async function createUser(attrs = {}) {
  const password = attrs.password || "Password@123";
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await db.User.create({
    username: attrs.username || `user_${Math.random().toString(36).slice(2, 8)}`,
    email: attrs.email || `user_${Math.random().toString(36).slice(2, 8)}@test.local`,
    password_hash: passwordHash,
    student_id: attrs.student_id || `${Math.floor(10 ** 10 + Math.random() * 9 * 10 ** 10)}`,
    role: attrs.role || "student",
    force_password_reset: Boolean(attrs.force_password_reset),
  });
  return { user, password };
}

async function addTenantMembership(tenant, user, role = "member") {
  return db.TenantMembership.create({
    tenant_id: tenant.id,
    user_id: user.id,
    role,
  });
}

async function createClub({ tenant, founder, name = "Chess Club" }) {
  const club = await db.Club.create({
    tenant_id: tenant.id,
    name,
    description: `${name} description`,
    founder_id: founder.id,
    status: "active",
  });
  await db.ClubMember.create({
    tenant_id: tenant.id,
    club_id: club.id,
    user_id: founder.id,
    role: "founder",
  });
  return club;
}

function signToken(user, tenant) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenant: tenant ? { id: tenant.id, code: tenant.code } : undefined,
      tenant_id: tenant ? tenant.id : undefined,
      tenant_code: tenant ? tenant.code : undefined,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

module.exports = {
  createTenant,
  createUser,
  addTenantMembership,
  createClub,
  signToken,
};
