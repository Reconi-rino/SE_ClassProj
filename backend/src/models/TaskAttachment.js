const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TaskAttachment = sequelize.define(
  "TaskAttachment",
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
    task_type: {
      type: DataTypes.ENUM("personal", "club"),
      allowNull: false,
    },
    task_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    stored_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    file_size: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    uploaded_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    attachment_type: {
      type: DataTypes.ENUM("reference", "submission"),
      allowNull: false,
      defaultValue: "reference",
    },
  },
  {
    tableName: "task_attachments",
    underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["tenant_id", "task_type", "task_id"] },
      { fields: ["uploaded_by"] },
    ],
  }
);

module.exports = TaskAttachment;
