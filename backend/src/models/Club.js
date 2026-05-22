const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Club = sequelize.define(
  "Club",
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
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    founder_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    cover_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "archived"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "clubs",
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["tenant_id", "name"],
      },
      {
        fields: ["tenant_id", "status"],
      },
      {
        fields: ["tenant_id", "founder_id"],
      },
      {
        fields: ["tenant_id", "created_at"],
      },
      {
        fields: ["tenant_id", "id"],
      },
    ],
  }
);

module.exports = Club;
