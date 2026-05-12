const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Activity = sequelize.define(
  "Activity",
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
    club_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "cancelled",
        "completed"
      ),
      allowNull: false,
      defaultValue: "draft",
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
  },
  {
    tableName: "activities",
    underscored: true,
    indexes: [
      {
        fields: ["tenant_id"],
      },
      {
        fields: ["tenant_id", "status"],
      },
      {
        fields: ["tenant_id", "club_id"],
      },
      {
        fields: ["tenant_id", "start_time"],
      },
      {
        fields: ["tenant_id", "created_at"],
      },
      {
        fields: ["created_by"],
      },
    ],
  }
);

module.exports = Activity;
