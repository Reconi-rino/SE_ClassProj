const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define(
  "ActivityRegistration",
  {
    activity_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    checked_in_at: { type: DataTypes.DATE, allowNull: true },
    cancellation_read_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "activity_registrations",
    underscored: true,
    updatedAt: false,
    indexes: [{ name: "idx_activity_registrations_tenant_user", fields: ["tenant_id", "user_id"] }],
  }
);
