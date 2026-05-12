const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ClubMember = sequelize.define(
  "ClubMember",
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
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("founder", "admin", "member"),
      allowNull: false,
      defaultValue: "member",
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "club_members",
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["tenant_id", "club_id", "user_id"],
      },
      {
        fields: ["tenant_id", "user_id"],
      },
      {
        fields: ["tenant_id", "club_id", "role"],
      },
      {
        fields: ["tenant_id", "joined_at"],
      },
    ],
  }
);

module.exports = ClubMember;
