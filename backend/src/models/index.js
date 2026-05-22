const { Sequelize } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");
const Tenant = require("./Tenant");
const TenantMembership = require("./TenantMembership");
const Club = require("./Club");
const ClubMember = require("./ClubMember");
const Activity = require("./Activity");
const Approval = require("./Approval");
const FinancialRecord = require("./FinancialRecord");
const PersonalTask = require("./PersonalTask");
const ClubTask = require("./ClubTask");

Tenant.hasMany(TenantMembership, {
  foreignKey: "tenant_id",
  as: "memberships",
});

TenantMembership.belongsTo(Tenant, {
  foreignKey: "tenant_id",
  as: "tenant",
});

User.hasMany(TenantMembership, {
  foreignKey: "user_id",
  as: "tenantMemberships",
});

TenantMembership.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

Tenant.hasMany(Club, {
  foreignKey: "tenant_id",
  as: "clubs",
});

Club.belongsTo(Tenant, {
  foreignKey: "tenant_id",
  as: "tenant",
});

User.hasMany(Club, {
  foreignKey: "founder_id",
  as: "foundedClubs",
});

Club.belongsTo(User, {
  foreignKey: "founder_id",
  as: "founder",
});

Tenant.hasMany(ClubMember, {
  foreignKey: "tenant_id",
  as: "clubMembers",
});

ClubMember.belongsTo(Tenant, {
  foreignKey: "tenant_id",
  as: "tenant",
});

Club.hasMany(ClubMember, {
  foreignKey: "club_id",
  as: "members",
});

ClubMember.belongsTo(Club, {
  foreignKey: "club_id",
  as: "club",
});

User.hasMany(ClubMember, {
  foreignKey: "user_id",
  as: "clubMemberships",
});

ClubMember.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

Tenant.hasMany(Activity, {
  foreignKey: "tenant_id",
  as: "activities",
});

Activity.belongsTo(Tenant, {
  foreignKey: "tenant_id",
  as: "tenant",
});

Club.hasMany(Activity, {
  foreignKey: "club_id",
  as: "activities",
});

Activity.belongsTo(Club, {
  foreignKey: "club_id",
  as: "club",
});

User.hasMany(Activity, {
  foreignKey: "created_by",
  as: "createdActivities",
});

Activity.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

Tenant.hasMany(Approval, {
  foreignKey: "tenant_id",
  as: "approvals",
});

Approval.belongsTo(Tenant, {
  foreignKey: "tenant_id",
  as: "tenant",
});

Activity.hasMany(Approval, {
  foreignKey: "activity_id",
  as: "approvals",
});

Approval.belongsTo(Activity, {
  foreignKey: "activity_id",
  as: "activity",
});

User.hasMany(Approval, {
  foreignKey: "approver_id",
  as: "approvalAssignments",
});

Approval.belongsTo(User, {
  foreignKey: "approver_id",
  as: "approver",
});

Tenant.hasMany(FinancialRecord, {
  foreignKey: "tenant_id",
  as: "financialRecords",
});

FinancialRecord.belongsTo(Tenant, {
  foreignKey: "tenant_id",
  as: "tenant",
});

Club.hasMany(FinancialRecord, {
  foreignKey: "club_id",
  as: "financialRecords",
});

FinancialRecord.belongsTo(Club, {
  foreignKey: "club_id",
  as: "club",
});

User.hasMany(FinancialRecord, {
  foreignKey: "created_by",
  as: "createdFinancialRecords",
});

FinancialRecord.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

Tenant.hasMany(PersonalTask, { foreignKey: "tenant_id", as: "personalTasks" });
PersonalTask.belongsTo(Tenant, { foreignKey: "tenant_id", as: "tenant" });
User.hasMany(PersonalTask, { foreignKey: "user_id", as: "personalTasks" });
PersonalTask.belongsTo(User, { foreignKey: "user_id", as: "user" });

Tenant.hasMany(ClubTask, { foreignKey: "tenant_id", as: "clubTasks" });
ClubTask.belongsTo(Tenant, { foreignKey: "tenant_id", as: "tenant" });
Club.hasMany(ClubTask, { foreignKey: "club_id", as: "clubTasks" });
ClubTask.belongsTo(Club, { foreignKey: "club_id", as: "club" });
Activity.hasMany(ClubTask, { foreignKey: "activity_id", as: "clubTasks" });
ClubTask.belongsTo(Activity, { foreignKey: "activity_id", as: "activity" });
User.hasMany(ClubTask, { foreignKey: "assignee_id", as: "assignedTasks" });
ClubTask.belongsTo(User, { foreignKey: "assignee_id", as: "assignee" });
User.hasMany(ClubTask, { foreignKey: "created_by", as: "createdClubTasks" });
ClubTask.belongsTo(User, { foreignKey: "created_by", as: "creator" });

const db = {
  sequelize,
  Sequelize,
  User,
  Tenant,
  TenantMembership,
  Club,
  ClubMember,
  Activity,
  Approval,
  FinancialRecord,
  PersonalTask,
  ClubTask,
};

module.exports = db;
