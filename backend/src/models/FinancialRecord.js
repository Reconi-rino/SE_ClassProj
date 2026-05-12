const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FinancialRecord = sequelize.define(
  "FinancialRecord",
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
    type: {
      type: DataTypes.ENUM("income", "expense"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    transaction_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
  },
  {
    tableName: "financial_records",
    underscored: true,
    indexes: [
      {
        fields: ["tenant_id"],
      },
      {
        fields: ["tenant_id", "club_id"],
      },
      {
        fields: ["tenant_id", "type"],
      },
      {
        fields: ["tenant_id", "category"],
      },
      {
        fields: ["tenant_id", "transaction_date"],
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

module.exports = FinancialRecord;
