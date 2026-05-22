const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ClubTask = sequelize.define(
  "ClubTask",
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
    activity_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assignee_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    assignee_ids: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    priority: {
      type: DataTypes.ENUM("low", "medium", "high"),
      allowNull: false,
      defaultValue: "medium",
    },
    status: {
      type: DataTypes.ENUM("pending", "in_progress", "completed"),
      allowNull: false,
      defaultValue: "pending",
    },
  },
  {
    tableName: "club_tasks",
    underscored: true,
    indexes: [
      { fields: ["tenant_id"] },
      { fields: ["tenant_id", "club_id"] },
      { fields: ["tenant_id", "assignee_id"] },
      { fields: ["tenant_id", "status"] },
    ],
  }
);

module.exports = ClubTask;
