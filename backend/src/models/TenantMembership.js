const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TenantMembership = sequelize.define(
  "TenantMembership",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("tenant_admin", "member"),
      allowNull: false,
      defaultValue: "member",
    },
  },
  {
    tableName: "tenant_memberships",
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["tenant_id", "user_id"],
      },
    ],
  }
);

module.exports = TenantMembership;
