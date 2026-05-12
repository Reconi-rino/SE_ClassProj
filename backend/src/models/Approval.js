const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Approval = sequelize.define(
  "Approval",
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
    activity_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    approver_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "changes_requested", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "approvals",
    underscored: true,
    indexes: [
      {
        fields: ["tenant_id"],
      },
      {
        fields: ["tenant_id", "status"],
      },
      {
        fields: ["tenant_id", "activity_id"],
      },
      {
        fields: ["tenant_id", "approver_id"],
      },
      {
        unique: true,
        fields: ["tenant_id", "activity_id", "approver_id"],
      },
    ],
  }
);

module.exports = Approval;
