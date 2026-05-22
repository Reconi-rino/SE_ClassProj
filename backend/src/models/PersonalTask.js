const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PersonalTask = sequelize.define(
  "PersonalTask",
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
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "personal_tasks",
    underscored: true,
    indexes: [
      { fields: ["tenant_id"] },
      { fields: ["tenant_id", "user_id"] },
      { fields: ["tenant_id", "user_id", "status"] },
    ],
  }
);

module.exports = PersonalTask;
